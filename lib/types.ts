// Synology Photos 数据类型定义

export interface Photo {
  id: string;
  path: string;
  filename: string;
  thumbnail?: string;
  
  // EXIF 数据
  takenAt?: Date;
  width?: number;
  height?: number;
  
  // GPS 位置
  latitude?: number;
  longitude?: number;
  locationName?: string;
  
  // 相机信息
  camera?: string;
  lens?: string;
  
  // 人脸识别 (Synology Photos 元数据)
  people?: string[];
  
  // 标签
  tags?: string[];
  
  // 相册
  album?: string;
}

export interface Album {
  id: string;
  name: string;
  path: string;
  coverPhoto?: string;
  photoCount: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface Person {
  id: string;
  name: string;
  photoCount: number;
  coverPhoto?: string;
}

export interface Location {
  name: string;
  latitude: number;
  longitude: number;
  photoCount: number;
  photos: string[]; // photo ids
}

// 故事类型
export type StoryType = 
  | 'years_ago'      // 多少年前的今天
  | 'people_together' // 人物同框
  | 'location'       // 地点故事
  | 'album'          // 相册故事
  | 'season'         // 季节回忆
  | 'random';        // 随机回忆

export interface Story {
  id: string;
  type: StoryType;
  title: string;
  subtitle?: string;
  description?: string;
  photos: Photo[];
  createdAt: Date;
  
  // 特定类型的元数据
  metadata?: {
    yearsAgo?: number;
    people?: string[];
    location?: string;
    dateRange?: { start: Date; end: Date };
  };
}

// Synology Photos @eaDir 元数据结构
export interface SynologyMetadata {
  version?: number;
  thumbnail?: {
    m?: string;
    xl?: string;
  };
  geocoding?: {
    country?: string;
    city?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  face?: Array<{
    id: string;
    name?: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }>;
  tags?: string[];
  // 拍摄时间 (ISO 字符串或时间戳)
  takenAt?: string | number;
}
