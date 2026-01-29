// 故事回顾生成器
import type { Photo, Story, StoryType, Person, Location } from "./types";
import type { PhotoScanner } from "./scanner";

export class StoryGenerator {
  private scanner: PhotoScanner;

  constructor(scanner: PhotoScanner) {
    this.scanner = scanner;
  }

  // 生成随机故事
  generateRandomStory(): Story | null {
    const storyTypes: StoryType[] = [
      "years_ago",
      "people_together",
      "location",
      "season",
    ];

    // 随机选择一种故事类型
    const randomType = storyTypes[Math.floor(Math.random() * storyTypes.length)];

    switch (randomType) {
      case "years_ago":
        return this.generateYearsAgoStory();
      case "people_together":
        return this.generatePeopleTogetherStory();
      case "location":
        return this.generateLocationStory();
      case "season":
        return this.generateSeasonStory();
      default:
        return this.generateRandomPhotosStory();
    }
  }

  // 多少年前的今天
  generateYearsAgoStory(targetDate?: Date): Story | null {
    const today = targetDate || new Date();
    const allPhotos = this.scanner.getAllPhotos();

    // 收集同一天（不同年份）的照片
    const photosOnThisDay: Map<number, Photo[]> = new Map();

    for (const photo of allPhotos) {
      if (!photo.takenAt) continue;

      if (
        photo.takenAt.getMonth() === today.getMonth() &&
        photo.takenAt.getDate() === today.getDate()
      ) {
        const year = photo.takenAt.getFullYear();
        if (!photosOnThisDay.has(year)) {
          photosOnThisDay.set(year, []);
        }
        photosOnThisDay.get(year)!.push(photo);
      }
    }

    if (photosOnThisDay.size === 0) {
      // 扩大范围：前后3天
      return this.generateNearbyDaysStory(today);
    }

    // 选择一个年份
    const years = Array.from(photosOnThisDay.keys()).sort((a, b) => a - b);
    const randomYear = years[Math.floor(Math.random() * years.length)];
    if (randomYear === undefined) return null;
    const yearsAgo = today.getFullYear() - randomYear;
    const photos = photosOnThisDay.get(randomYear)!;

    if (yearsAgo <= 0) return null;

    // 获取地点信息
    const locations = [...new Set(photos.map(p => p.locationName).filter(Boolean))];
    const people = [...new Set(photos.flatMap(p => p.people || []))];

    let subtitle = "";
    if (locations.length > 0) {
      subtitle = `在${locations.slice(0, 2).join("、")}`;
    }
    if (people.length > 0) {
      subtitle += subtitle ? `，与${people.slice(0, 3).join("、")}` : `与${people.slice(0, 3).join("、")}`;
    }

    return {
      id: `years-ago-${randomYear}-${today.getMonth()}-${today.getDate()}`,
      type: "years_ago",
      title: `${yearsAgo}年前的今天`,
      subtitle: subtitle || undefined,
      description: `${randomYear}年${today.getMonth() + 1}月${today.getDate()}日的回忆`,
      photos: this.shuffleAndLimit(photos, 20),
      createdAt: new Date(),
      metadata: {
        yearsAgo,
        people: people.length > 0 ? people : undefined,
        location: locations.length > 0 ? locations[0] : undefined,
      },
    };
  }

  // 附近几天的回忆
  private generateNearbyDaysStory(today: Date): Story | null {
    const allPhotos = this.scanner.getAllPhotos();
    const nearbyPhotos: Photo[] = [];

    for (const photo of allPhotos) {
      if (!photo.takenAt) continue;

      const photoDate = new Date(photo.takenAt);
      // 设置为同一年来比较日期差
      const thisYearPhotoDate = new Date(
        today.getFullYear(),
        photoDate.getMonth(),
        photoDate.getDate()
      );
      const diffDays = Math.abs(
        (today.getTime() - thisYearPhotoDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays <= 7 && photoDate.getFullYear() < today.getFullYear()) {
        nearbyPhotos.push(photo);
      }
    }

    if (nearbyPhotos.length === 0) return null;

    return {
      id: `nearby-days-${Date.now()}`,
      type: "years_ago",
      title: "这周的回忆",
      subtitle: "往年这个时候...",
      photos: this.shuffleAndLimit(nearbyPhotos, 20),
      createdAt: new Date(),
    };
  }

  // 人物同框故事
  generatePeopleTogetherStory(): Story | null {
    const people = this.scanner.getAllPeople();

    if (people.length < 2) return null;

    // 随机选择2-3个人
    const shuffledPeople = this.shuffleArray([...people]);
    const selectedPeople = shuffledPeople.slice(0, Math.min(3, shuffledPeople.length));
    const selectedNames = selectedPeople.map(p => p.name);

    // 查找同时包含这些人的照片
    const photos = this.scanner.getPhotosWithPeople(selectedNames);

    if (photos.length === 0) {
      // 如果没有同时出现的，尝试只选2个人
      if (selectedNames.length > 2) {
        const twoNames = selectedNames.slice(0, 2);
        const twoPhotos = this.scanner.getPhotosWithPeople(twoNames);
        if (twoPhotos.length > 0) {
          return this.createPeopleStory(twoNames, twoPhotos);
        }
      }
      return null;
    }

    return this.createPeopleStory(selectedNames, photos);
  }

  private createPeopleStory(names: string[], photos: Photo[]): Story {
    // 分析这些人的共同经历
    const locations = [...new Set(photos.map(p => p.locationName).filter(Boolean))];
    const years = [...new Set(photos.map(p => p.takenAt?.getFullYear()).filter(Boolean))].sort();

    let description = "";
    if (years.length > 1) {
      description = `从${years[0]}年到${years[years.length - 1]}年的共同时光`;
    } else if (years.length === 1) {
      description = `${years[0]}年的共同回忆`;
    }

    if (locations.length > 0) {
      description += description ? `，足迹遍布${locations.slice(0, 3).join("、")}` : `在${locations.slice(0, 3).join("、")}的故事`;
    }

    return {
      id: `people-${names.join("-")}-${Date.now()}`,
      type: "people_together",
      title: `${names.join(" & ")} 的故事`,
      subtitle: `${photos.length}张共同的照片`,
      description,
      photos: this.shuffleAndLimit(photos, 30),
      createdAt: new Date(),
      metadata: {
        people: names,
      },
    };
  }

  // 地点故事
  generateLocationStory(): Story | null {
    const locations = this.scanner.getAllLocations();

    if (locations.length === 0) return null;

    // 随机选择一个地点（优先选择照片较多的）
    const weightedLocations = locations.flatMap(loc =>
      Array(Math.min(loc.photoCount, 10)).fill(loc)
    );
    const selectedLocation = weightedLocations[
      Math.floor(Math.random() * weightedLocations.length)
    ];

    const photos = this.scanner.getLocationPhotos(selectedLocation.name);

    if (photos.length === 0) return null;

    // 分析这个地点的故事
    const people = [...new Set(photos.flatMap(p => p.people || []))];
    const years = [...new Set(photos.map(p => p.takenAt?.getFullYear()).filter(Boolean))].sort();

    let description = "";
    if (years.length > 1) {
      description = `${years[0]}年至${years[years.length - 1]}年的回忆`;
    } else if (years.length === 1) {
      description = `${years[0]}年的故事`;
    }

    if (people.length > 0) {
      description += description ? `，与${people.slice(0, 4).join("、")}一起` : `与${people.slice(0, 4).join("、")}的时光`;
    }

    return {
      id: `location-${selectedLocation.name}-${Date.now()}`,
      type: "location",
      title: `${selectedLocation.name}的故事`,
      subtitle: `${photos.length}张照片的回忆`,
      description,
      photos: this.shuffleAndLimit(photos, 30),
      createdAt: new Date(),
      metadata: {
        location: selectedLocation.name,
        people: people.length > 0 ? people : undefined,
      },
    };
  }

  // 季节回忆
  generateSeasonStory(): Story | null {
    const today = new Date();
    const month = today.getMonth();

    // 确定当前季节
    let season: string;
    let seasonMonths: number[];
    if (month >= 2 && month <= 4) {
      season = "春天";
      seasonMonths = [2, 3, 4];
    } else if (month >= 5 && month <= 7) {
      season = "夏天";
      seasonMonths = [5, 6, 7];
    } else if (month >= 8 && month <= 10) {
      season = "秋天";
      seasonMonths = [8, 9, 10];
    } else {
      season = "冬天";
      seasonMonths = [11, 0, 1];
    }

    const allPhotos = this.scanner.getAllPhotos();
    const seasonPhotos = allPhotos.filter(p => {
      if (!p.takenAt) return false;
      const photoMonth = p.takenAt.getMonth();
      const photoYear = p.takenAt.getFullYear();
      return seasonMonths.includes(photoMonth) && photoYear < today.getFullYear();
    });

    if (seasonPhotos.length === 0) return null;

    // 按年份分组
    const byYear = new Map<number, Photo[]>();
    for (const photo of seasonPhotos) {
      const year = photo.takenAt!.getFullYear();
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year)!.push(photo);
    }

    // 选择一个随机年份
    const years = Array.from(byYear.keys());
    const randomYear = years[Math.floor(Math.random() * years.length)];
    if (randomYear === undefined) return null;
    const photos = byYear.get(randomYear)!;

    const locations = [...new Set(photos.map(p => p.locationName).filter(Boolean))];

    return {
      id: `season-${season}-${randomYear}`,
      type: "season",
      title: `${randomYear}年的${season}`,
      subtitle: locations.length > 0 ? `在${locations.slice(0, 2).join("、")}` : undefined,
      photos: this.shuffleAndLimit(photos, 25),
      createdAt: new Date(),
      metadata: {
        dateRange: {
          start: new Date(randomYear, seasonMonths[0]!, 1),
          end: new Date(randomYear, seasonMonths[2]!, 28),
        },
      },
    };
  }

  // 随机照片故事
  generateRandomPhotosStory(): Story {
    const allPhotos = this.scanner.getAllPhotos();
    const photos = this.shuffleAndLimit(allPhotos, 20);

    return {
      id: `random-${Date.now()}`,
      type: "random",
      title: "随机回忆",
      subtitle: `${allPhotos.length}张照片中的精选`,
      photos,
      createdAt: new Date(),
    };
  }

  // 生成多个故事
  generateMultipleStories(count: number = 5): Story[] {
    const stories: Story[] = [];
    const seenTypes = new Set<string>();

    // 优先生成"今天"的故事
    const yearsAgoStory = this.generateYearsAgoStory();
    if (yearsAgoStory) {
      stories.push(yearsAgoStory);
      seenTypes.add("years_ago");
    }

    // 生成其他类型的故事
    const generators = [
      () => this.generatePeopleTogetherStory(),
      () => this.generateLocationStory(),
      () => this.generateSeasonStory(),
      () => this.generateRandomPhotosStory(),
    ];

    for (const generator of this.shuffleArray(generators)) {
      if (stories.length >= count) break;

      const story = generator();
      if (story && !seenTypes.has(story.type)) {
        stories.push(story);
        seenTypes.add(story.type);
      }
    }

    // 如果还不够，生成更多随机故事
    while (stories.length < count) {
      const story = this.generateRandomStory();
      if (story) {
        stories.push(story);
      } else {
        break;
      }
    }

    return stories;
  }

  // 辅助方法
  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = result[i]!;
      result[i] = result[j]!;
      result[j] = temp;
    }
    return result;
  }

  private shuffleAndLimit<T>(array: T[], limit: number): T[] {
    return this.shuffleArray(array).slice(0, limit);
  }
}
