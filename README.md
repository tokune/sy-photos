# Photo Memories - Synology Photos 相册展示网站

基于 Bun 构建的照片回忆网站，支持 Synology Photos 目录格式，具有随机故事回顾功能。

## 功能特点

- **故事回顾模式**
  - 多少年前的今天：回顾往年同一天的照片
  - 人物同框：展示多个人物一起出现的照片故事
  - 地点故事：按拍摄地点组织照片回忆
  - 季节回忆：展示往年同一季节的照片

- **照片浏览**
  - 按相册浏览
  - 按人物浏览
  - 按地点浏览
  - 全屏照片查看器

- **Synology Photos 兼容**
  - 读取 `@eaDir` 元数据
  - 支持人脸识别数据
  - 支持地理位置信息
  - 使用 Synology 生成的缩略图

## 快速开始

```bash
# 安装依赖
bun install

# 生成示例数据（可选，用于测试）
bun scripts/generate-sample.ts

# 启动开发服务器
bun run dev

# 或指定照片目录
PHOTOS_DIR=/path/to/synology/photos bun run dev
```

访问 http://localhost:3000 查看相册。

## 目录结构

项目期望的 Synology Photos 目录结构：

```
photos/
├── 2023/
│   ├── 春节/
│   │   ├── IMG_001.jpg
│   │   ├── IMG_002.jpg
│   │   └── @eaDir/
│   │       ├── IMG_001.jpg/
│   │       │   ├── SYNOPHOTO_METADATA.json
│   │       │   └── SYNOPHOTO_THUMB_XL.jpg
│   │       └── IMG_002.jpg/
│   │           └── ...
│   └── 夏日旅行/
│       └── ...
├── 2024/
│   └── ...
└── @eaDir/
```

## Synology 元数据格式

`SYNOPHOTO_METADATA.json` 示例：

```json
{
  "version": 1,
  "face": [
    {
      "id": "face-1",
      "name": "小明",
      "x": 0.3,
      "y": 0.2,
      "w": 0.15,
      "h": 0.2
    }
  ],
  "geocoding": {
    "country": "中国",
    "city": "北京",
    "address": "天安门广场"
  },
  "tags": ["家庭", "旅行"]
}
```

## API 接口

| 接口 | 说明 |
|------|------|
| `GET /api/stats` | 获取统计信息 |
| `GET /api/photos` | 获取所有照片 |
| `GET /api/albums` | 获取相册列表 |
| `GET /api/people` | 获取人物列表 |
| `GET /api/locations` | 获取地点列表 |
| `GET /api/stories` | 获取故事列表 |
| `GET /api/stories/random` | 生成随机故事 |
| `GET /api/stories/refresh` | 刷新所有故事 |
| `GET /api/stories/today` | 获取今天的回忆 |
| `GET /photo/:id` | 获取原图 |
| `GET /thumb/:id` | 获取缩略图 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PHOTOS_DIR` | `./photos` | 照片目录路径 |
| `PORT` | `3000` | 服务器端口 |

## 从 Synology NAS 使用

1. 在 NAS 上挂载 Photos 共享文件夹
2. 设置 `PHOTOS_DIR` 指向挂载路径
3. 启动服务器

```bash
# macOS/Linux 挂载示例
mount -t nfs nas.local:/volume1/photo /mnt/photos

# 启动服务
PHOTOS_DIR=/mnt/photos bun run start
```

## 技术栈

- **后端**: Bun + TypeScript
- **前端**: React 19
- **EXIF 解析**: exifreader
- **样式**: 纯 CSS（暗色主题）

## 开发

```bash
# 热重载开发
bun run dev

# 类型检查
bun run tsc --noEmit
```

## License

MIT
