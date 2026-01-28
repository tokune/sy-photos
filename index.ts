// 主服务器入口
import { PhotoScanner } from "./lib/scanner";
import { StoryGenerator } from "./lib/stories";
import type { Photo } from "./lib/types";
import index from "./src/index.html";

// 配置
const PHOTOS_DIR = process.env.PHOTOS_DIR || "./photos";
const PORT = parseInt(process.env.PORT || "3000");

// 初始化扫描器和故事生成器
const scanner = new PhotoScanner(PHOTOS_DIR);
let storyGenerator: StoryGenerator;

// 启动时扫描照片
console.log("Starting photo gallery server...");
await scanner.scan();
storyGenerator = new StoryGenerator(scanner);

// 缓存已生成的故事
let cachedStories = storyGenerator.generateMultipleStories(10);
const storiesLastGenerated = new Date();

// 每小时刷新故事
setInterval(() => {
  cachedStories = storyGenerator.generateMultipleStories(10);
}, 60 * 60 * 1000);

// API 响应辅助函数
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 500) {
  return jsonResponse({ error: message }, status);
}

// 处理照片文件请求
async function servePhoto(photo: Photo, type: "original" | "thumbnail") {
  const filePath = type === "thumbnail" && photo.thumbnail ? photo.thumbnail : photo.path;

  try {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return new Response("Photo not found", { status: 404 });
    }

    return new Response(file, {
      headers: {
        "Content-Type": file.type,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch {
    return new Response("Error loading photo", { status: 500 });
  }
}

// 启动服务器
Bun.serve({
  port: PORT,
  routes: {
    // 首页
    "/": index,

    // API: 获取所有照片
    "/api/photos": () => {
      const photos = scanner.getAllPhotos().map(p => ({
        ...p,
        path: undefined, // 不暴露服务器路径
        thumbnail: p.thumbnail ? undefined : undefined,
      }));
      return jsonResponse({ photos, total: photos.length });
    },

    // API: 获取相册列表
    "/api/albums": () => {
      return jsonResponse({ albums: scanner.getAllAlbums() });
    },

    // API: 获取人物列表
    "/api/people": () => {
      return jsonResponse({ people: scanner.getAllPeople() });
    },

    // API: 获取地点列表
    "/api/locations": () => {
      return jsonResponse({ locations: scanner.getAllLocations() });
    },

    // API: 获取故事列表
    "/api/stories": () => {
      return jsonResponse({ stories: cachedStories });
    },

    // API: 生成新的随机故事
    "/api/stories/random": () => {
      const story = storyGenerator.generateRandomStory();
      if (!story) {
        return errorResponse("No stories available", 404);
      }
      return jsonResponse({ story });
    },

    // API: 刷新所有故事
    "/api/stories/refresh": () => {
      cachedStories = storyGenerator.generateMultipleStories(10);
      return jsonResponse({ stories: cachedStories });
    },

    // API: 获取"今天"的故事
    "/api/stories/today": () => {
      const story = storyGenerator.generateYearsAgoStory();
      if (!story) {
        return jsonResponse({ story: null, message: "今天没有历史回忆" });
      }
      return jsonResponse({ story });
    },

    // API: 获取指定日期的故事
    "/api/stories/date/:date": (req) => {
      const dateStr = req.params.date;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return errorResponse("Invalid date format", 400);
      }
      const story = storyGenerator.generateYearsAgoStory(date);
      return jsonResponse({ story });
    },

    // 动态路由：获取单张照片
    "/api/photos/:id": (req) => {
      const photo = scanner.getPhoto(req.params.id);
      if (!photo) {
        return errorResponse("Photo not found", 404);
      }
      return jsonResponse({
        ...photo,
        path: undefined,
        thumbnail: undefined,
      });
    },

    // 动态路由：获取照片文件
    "/photo/:id": async (req) => {
      const photo = scanner.getPhoto(req.params.id);
      if (!photo) {
        return new Response("Photo not found", { status: 404 });
      }
      return servePhoto(photo, "original");
    },

    // 动态路由：获取缩略图
    "/thumb/:id": async (req) => {
      const photo = scanner.getPhoto(req.params.id);
      if (!photo) {
        return new Response("Photo not found", { status: 404 });
      }
      return servePhoto(photo, "thumbnail");
    },

    // 动态路由：获取相册照片
    "/api/albums/:id/photos": (req) => {
      const album = scanner.getAlbum(req.params.id);
      if (!album) {
        return errorResponse("Album not found", 404);
      }
      const photos = scanner.getAlbumPhotos(album.name);
      return jsonResponse({ album, photos });
    },

    // 动态路由：获取人物照片
    "/api/people/:name/photos": (req) => {
      const personName = decodeURIComponent(req.params.name);
      const photos = scanner.getPersonPhotos(personName);
      return jsonResponse({ person: personName, photos });
    },

    // 动态路由：获取地点照片
    "/api/locations/:name/photos": (req) => {
      const locationName = decodeURIComponent(req.params.name);
      const photos = scanner.getLocationPhotos(locationName);
      return jsonResponse({ location: locationName, photos });
    },

    // 统计信息
    "/api/stats": () => {
      const photos = scanner.getAllPhotos();
      const years = [...new Set(photos.map(p => p.takenAt?.getFullYear()).filter(Boolean))].sort();

      return jsonResponse({
        totalPhotos: photos.length,
        totalAlbums: scanner.getAllAlbums().length,
        totalPeople: scanner.getAllPeople().length,
        totalLocations: scanner.getAllLocations().length,
        yearRange: years.length > 0 ? { start: years[0], end: years[years.length - 1] } : null,
        storiesCount: cachedStories.length,
      });
    },

    // 重新扫描照片
    "/api/rescan": async () => {
      await scanner.scan();
      cachedStories = storyGenerator.generateMultipleStories(10);
      return jsonResponse({ message: "Rescan complete", stats: {
        photos: scanner.getAllPhotos().length,
        albums: scanner.getAllAlbums().length,
      }});
    },
  },

  development: {
    hmr: true,
    console: true,
  },

  fetch(req) {
    // 处理未匹配的路由
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Photo gallery server running at http://localhost:${PORT}`);
console.log(`Photos directory: ${PHOTOS_DIR}`);
