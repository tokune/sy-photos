// Synology Photos 数据扫描和解析器
import { readdir, stat } from "node:fs/promises";
import { join, extname, basename, dirname } from "node:path";
import ExifReader from "exifreader";
import type { Photo, Album, Person, Location, SynologyMetadata } from "./types";

const PHOTO_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".gif", ".bmp", ".tiff"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".avi", ".mkv", ".webm"]);

export class PhotoScanner {
  private photosRoot: string;
  private photos: Map<string, Photo> = new Map();
  private albums: Map<string, Album> = new Map();
  private people: Map<string, Person> = new Map();
  private locations: Map<string, Location> = new Map();
  private indexed: boolean = false;

  constructor(photosRoot: string) {
    this.photosRoot = photosRoot;
  }

  async scan(): Promise<void> {
    console.log(`Scanning photos from: ${this.photosRoot}`);
    await this.scanDirectory(this.photosRoot);
    this.indexed = true;
    console.log(`Found ${this.photos.size} photos in ${this.albums.size} albums`);
    console.log(`Found ${this.people.size} people and ${this.locations.size} locations`);
  }

  private async scanDirectory(dir: string, albumName?: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        // 跳过 @eaDir 和隐藏文件夹（但我们会读取其中的元数据）
        if (entry.name === "@eaDir" || entry.name.startsWith(".")) {
          continue;
        }

        if (entry.isDirectory()) {
          // 子目录作为相册
          const newAlbumName = albumName ? `${albumName}/${entry.name}` : entry.name;
          await this.scanDirectory(fullPath, newAlbumName);
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          if (PHOTO_EXTENSIONS.has(ext)) {
            await this.processPhoto(fullPath, albumName);
          }
        }
      }

      // 更新相册信息
      if (albumName) {
        this.updateAlbum(albumName, dir);
      }
    } catch (error) {
      console.error(`Error scanning directory ${dir}:`, error);
    }
  }

  private async processPhoto(filePath: string, albumName?: string): Promise<void> {
    const id = this.generateId(filePath);
    const filename = basename(filePath);

    try {
      const photo: Photo = {
        id,
        path: filePath,
        filename,
        album: albumName,
      };

      // 读取 EXIF 数据
      await this.extractExifData(filePath, photo);

      // 尝试读取 Synology 元数据
      await this.extractSynologyMetadata(filePath, photo);

      // 更新人物索引
      if (photo.people) {
        for (const personName of photo.people) {
          this.addPersonPhoto(personName, photo);
        }
      }

      // 更新地点索引
      if (photo.locationName && photo.latitude && photo.longitude) {
        this.addLocationPhoto(photo.locationName, photo);
      }

      this.photos.set(id, photo);
    } catch (error) {
      // 即使解析失败也添加基本信息
      this.photos.set(id, {
        id,
        path: filePath,
        filename,
        album: albumName,
      });
    }
  }

  private async extractExifData(filePath: string, photo: Photo): Promise<void> {
    try {
      const file = Bun.file(filePath);
      const buffer = await file.arrayBuffer();
      const tags = ExifReader.load(buffer, { expanded: true });

      // 拍摄时间
      if (tags.exif?.DateTimeOriginal) {
        const dateStr = tags.exif.DateTimeOriginal.description;
        photo.takenAt = this.parseExifDate(dateStr);
      }

      // 图片尺寸
      if (tags.file?.["Image Width"] && tags.file?.["Image Height"]) {
        photo.width = tags.file["Image Width"].value;
        photo.height = tags.file["Image Height"].value;
      }

      // GPS 位置
      if (tags.gps?.Latitude && tags.gps?.Longitude) {
        photo.latitude = tags.gps.Latitude;
        photo.longitude = tags.gps.Longitude;
      }

      // 相机信息
      if (tags.exif?.Make && tags.exif?.Model) {
        photo.camera = `${tags.exif.Make.description} ${tags.exif.Model.description}`;
      }

      if (tags.exif?.LensModel) {
        photo.lens = tags.exif.LensModel.description;
      }
    } catch (error) {
      // EXIF 读取失败，使用文件修改时间
      try {
        const fileStat = await stat(filePath);
        photo.takenAt = fileStat.mtime;
      } catch {}
    }
  }

  private async extractSynologyMetadata(filePath: string, photo: Photo): Promise<void> {
    const dir = dirname(filePath);
    const filename = basename(filePath);
    const eaDirPath = join(dir, "@eaDir", filename);

    try {
      // Synology Photos 存储元数据的几种可能格式
      const metadataFiles = [
        join(eaDirPath, "SYNOPHOTO_METADATA.json"),
        join(eaDirPath, "SYNO_PHOTO_METADATA.json"),
      ];

      for (const metaPath of metadataFiles) {
        try {
          const file = Bun.file(metaPath);
          if (await file.exists()) {
            const metadata: SynologyMetadata = await file.json();

            // 人脸识别数据
            if (metadata.face && metadata.face.length > 0) {
              photo.people = metadata.face
                .filter(f => f.name)
                .map(f => f.name!);
            }

            // 地理编码
            if (metadata.geocoding) {
              const parts = [
                metadata.geocoding.city,
                metadata.geocoding.country,
              ].filter(Boolean);
              if (parts.length > 0) {
                photo.locationName = parts.join(", ");
              }
              // GPS 坐标
              if (metadata.geocoding.latitude && metadata.geocoding.longitude) {
                photo.latitude = metadata.geocoding.latitude;
                photo.longitude = metadata.geocoding.longitude;
              }
            }

            // 拍摄时间 (从元数据读取)
            if (metadata.takenAt && !photo.takenAt) {
              if (typeof metadata.takenAt === 'string') {
                photo.takenAt = new Date(metadata.takenAt);
              } else if (typeof metadata.takenAt === 'number') {
                photo.takenAt = new Date(metadata.takenAt);
              }
            }

            // 标签
            if (metadata.tags) {
              photo.tags = metadata.tags;
            }

            // 缩略图路径
            if (metadata.thumbnail?.xl) {
              photo.thumbnail = join(eaDirPath, metadata.thumbnail.xl);
            } else if (metadata.thumbnail?.m) {
              photo.thumbnail = join(eaDirPath, metadata.thumbnail.m);
            }

            break;
          }
        } catch {}
      }

      // 查找缩略图
      const thumbPaths = [
        join(eaDirPath, "SYNOPHOTO_THUMB_XL.jpg"),
        join(eaDirPath, "SYNOPHOTO_THUMB_M.jpg"),
        join(eaDirPath, "SYNOPHOTO_THUMB_SM.jpg"),
      ];

      for (const thumbPath of thumbPaths) {
        const thumbFile = Bun.file(thumbPath);
        if (await thumbFile.exists()) {
          photo.thumbnail = thumbPath;
          break;
        }
      }
    } catch (error) {
      // 没有 Synology 元数据，跳过
    }
  }

  private parseExifDate(dateStr: string): Date {
    // EXIF 日期格式: "2024:01:15 14:30:00"
    const cleaned = dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
    return new Date(cleaned);
  }

  private generateId(filePath: string): string {
    const relative = filePath.replace(this.photosRoot, "");
    return Buffer.from(relative).toString("base64url");
  }

  private updateAlbum(albumName: string, path: string): void {
    const photos = Array.from(this.photos.values())
      .filter(p => p.album === albumName);

    if (photos.length === 0) return;

    const dates = photos
      .filter(p => p.takenAt)
      .map(p => p.takenAt!.getTime())
      .sort((a, b) => a - b);

    this.albums.set(albumName, {
      id: Buffer.from(albumName).toString("base64url"),
      name: albumName,
      path,
      coverPhoto: photos[0]?.id,
      photoCount: photos.length,
      dateRange: dates.length > 0 ? {
        start: new Date(dates[0]),
        end: new Date(dates[dates.length - 1]),
      } : undefined,
    });
  }

  private addPersonPhoto(personName: string, photo: Photo): void {
    const existing = this.people.get(personName);
    if (existing) {
      existing.photoCount++;
    } else {
      this.people.set(personName, {
        id: Buffer.from(personName).toString("base64url"),
        name: personName,
        photoCount: 1,
        coverPhoto: photo.id,
      });
    }
  }

  private addLocationPhoto(locationName: string, photo: Photo): void {
    const existing = this.locations.get(locationName);
    if (existing) {
      existing.photoCount++;
      existing.photos.push(photo.id);
    } else {
      this.locations.set(locationName, {
        name: locationName,
        latitude: photo.latitude!,
        longitude: photo.longitude!,
        photoCount: 1,
        photos: [photo.id],
      });
    }
  }

  // Getter 方法
  getAllPhotos(): Photo[] {
    return Array.from(this.photos.values());
  }

  getPhoto(id: string): Photo | undefined {
    return this.photos.get(id);
  }

  getAllAlbums(): Album[] {
    return Array.from(this.albums.values());
  }

  getAlbum(id: string): Album | undefined {
    return this.albums.get(id);
  }

  getAlbumPhotos(albumName: string): Photo[] {
    return this.getAllPhotos().filter(p => p.album === albumName);
  }

  getAllPeople(): Person[] {
    return Array.from(this.people.values()).sort((a, b) => b.photoCount - a.photoCount);
  }

  getPersonPhotos(personName: string): Photo[] {
    return this.getAllPhotos().filter(p => p.people?.includes(personName));
  }

  getAllLocations(): Location[] {
    return Array.from(this.locations.values()).sort((a, b) => b.photoCount - a.photoCount);
  }

  getLocationPhotos(locationName: string): Photo[] {
    return this.getAllPhotos().filter(p => p.locationName === locationName);
  }

  // 按日期查询
  getPhotosByDate(date: Date): Photo[] {
    const targetMonth = date.getMonth();
    const targetDay = date.getDate();

    return this.getAllPhotos().filter(p => {
      if (!p.takenAt) return false;
      return p.takenAt.getMonth() === targetMonth && p.takenAt.getDate() === targetDay;
    });
  }

  getPhotosByYear(year: number): Photo[] {
    return this.getAllPhotos().filter(p => {
      if (!p.takenAt) return false;
      return p.takenAt.getFullYear() === year;
    });
  }

  // 获取包含多个人物的照片
  getPhotosWithPeople(people: string[]): Photo[] {
    return this.getAllPhotos().filter(p => {
      if (!p.people) return false;
      return people.every(person => p.people!.includes(person));
    });
  }

  isIndexed(): boolean {
    return this.indexed;
  }
}
