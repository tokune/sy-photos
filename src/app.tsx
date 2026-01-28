import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

// Types
interface Photo {
  id: string;
  filename: string;
  takenAt?: string;
  locationName?: string;
  people?: string[];
  album?: string;
}

interface Story {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  description?: string;
  photos: Photo[];
  metadata?: {
    yearsAgo?: number;
    people?: string[];
    location?: string;
  };
}

interface Album {
  id: string;
  name: string;
  photoCount: number;
  coverPhoto?: string;
}

interface Person {
  id: string;
  name: string;
  photoCount: number;
  coverPhoto?: string;
}

interface Location {
  name: string;
  photoCount: number;
}

interface Stats {
  totalPhotos: number;
  totalAlbums: number;
  totalPeople: number;
  totalLocations: number;
  yearRange?: { start: number; end: number };
}

// API functions
const api = {
  getStats: () => fetch("/api/stats").then(r => r.json()),
  getStories: () => fetch("/api/stories").then(r => r.json()),
  refreshStories: () => fetch("/api/stories/refresh").then(r => r.json()),
  getRandomStory: () => fetch("/api/stories/random").then(r => r.json()),
  getTodayStory: () => fetch("/api/stories/today").then(r => r.json()),
  getAlbums: () => fetch("/api/albums").then(r => r.json()),
  getPeople: () => fetch("/api/people").then(r => r.json()),
  getLocations: () => fetch("/api/locations").then(r => r.json()),
  getAlbumPhotos: (id: string) => fetch(`/api/albums/${id}/photos`).then(r => r.json()),
  getPersonPhotos: (name: string) => fetch(`/api/people/${encodeURIComponent(name)}/photos`).then(r => r.json()),
  getLocationPhotos: (name: string) => fetch(`/api/locations/${encodeURIComponent(name)}/photos`).then(r => r.json()),
};

// Icons
const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 4v6h-6M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ChevronLeft = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRight = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

// Story type label
const storyTypeLabels: Record<string, string> = {
  years_ago: "往年今日",
  people_together: "人物故事",
  location: "地点故事",
  season: "季节回忆",
  random: "随机回忆",
};

// Format date
function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Stats Bar Component
function StatsBar({ stats }: { stats: Stats }) {
  return (
    <div className="stats-bar">
      <div className="stat-item">
        <div className="stat-value">{stats.totalPhotos.toLocaleString()}</div>
        <div className="stat-label">照片</div>
      </div>
      <div className="stat-item">
        <div className="stat-value">{stats.totalAlbums}</div>
        <div className="stat-label">相册</div>
      </div>
      <div className="stat-item">
        <div className="stat-value">{stats.totalPeople}</div>
        <div className="stat-label">人物</div>
      </div>
      <div className="stat-item">
        <div className="stat-value">{stats.totalLocations}</div>
        <div className="stat-label">地点</div>
      </div>
      {stats.yearRange && (
        <div className="stat-item">
          <div className="stat-value">{stats.yearRange.end - stats.yearRange.start + 1}</div>
          <div className="stat-label">年份跨度</div>
        </div>
      )}
    </div>
  );
}

// Story Card Component
function StoryCard({ story, onClick, featured = false }: { story: Story; onClick: () => void; featured?: boolean }) {
  const coverPhotos = story.photos.slice(0, featured ? 4 : 4);

  return (
    <div className={`story-card ${featured ? "featured" : ""}`} onClick={onClick}>
      <div className={`story-cover ${featured ? "featured" : ""}`}>
        <div className={`story-cover-grid ${coverPhotos.length === 1 ? "single" : ""}`}>
          {coverPhotos.map((photo, i) => (
            <img
              key={photo.id}
              src={`/thumb/${photo.id}`}
              alt=""
              className="story-cover-image"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `/photo/${photo.id}`;
              }}
            />
          ))}
        </div>
        <div className="story-overlay">
          <span className={`story-type ${story.type.replace("_", "-")}`}>
            {storyTypeLabels[story.type] || story.type}
          </span>
          <h3 className="story-title">{story.title}</h3>
          {story.subtitle && <p className="story-subtitle">{story.subtitle}</p>}
        </div>
      </div>
      <div className="story-meta">
        <span className="story-count">{story.photos.length} 张照片</span>
        {story.description && <span className="story-count">{story.description}</span>}
      </div>
    </div>
  );
}

// Story View Modal
function StoryModal({
  story,
  onClose,
  onPhotoClick,
}: {
  story: Story;
  onClose: () => void;
  onPhotoClick: (photo: Photo, index: number) => void;
}) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="modal-overlay">
      <div className="modal-header">
        <div>
          <h2 className="modal-title">{story.title}</h2>
          {story.subtitle && <p className="modal-subtitle">{story.subtitle}</p>}
        </div>
        <button className="modal-close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div className="modal-content">
        {story.description && (
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem", textAlign: "center" }}>
            {story.description}
          </p>
        )}
        <div className="story-photo-grid">
          {story.photos.map((photo, index) => (
            <div key={photo.id} className="story-photo-item" onClick={() => onPhotoClick(photo, index)}>
              <img
                src={`/thumb/${photo.id}`}
                alt={photo.filename}
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `/photo/${photo.id}`;
                }}
              />
              <div className="story-photo-info">
                {photo.takenAt && <div className="story-photo-date">{formatDate(photo.takenAt)}</div>}
                {photo.locationName && <div className="story-photo-location">{photo.locationName}</div>}
                {photo.people && photo.people.length > 0 && (
                  <div className="story-photo-people">
                    {photo.people.map(person => (
                      <span key={person} className="person-tag">{person}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Photo Viewer
function PhotoViewer({
  photos,
  currentIndex,
  onClose,
  onNavigate,
}: {
  photos: Photo[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const photo = photos[currentIndex];

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && currentIndex > 0) onNavigate(currentIndex - 1);
      if (e.key === "ArrowRight" && currentIndex < photos.length - 1) onNavigate(currentIndex + 1);
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [currentIndex, photos.length, onClose, onNavigate]);

  return (
    <div className="photo-viewer">
      <div className="photo-viewer-header">
        <div>
          <span style={{ color: "var(--text-secondary)" }}>
            {currentIndex + 1} / {photos.length}
          </span>
        </div>
        <button className="modal-close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div className="photo-viewer-content">
        {currentIndex > 0 && (
          <button className="photo-nav-btn prev" onClick={() => onNavigate(currentIndex - 1)}>
            <ChevronLeft />
          </button>
        )}
        <img
          src={`/photo/${photo.id}`}
          alt={photo.filename}
          className="photo-viewer-image"
        />
        {currentIndex < photos.length - 1 && (
          <button className="photo-nav-btn next" onClick={() => onNavigate(currentIndex + 1)}>
            <ChevronRight />
          </button>
        )}
      </div>
      <div className="photo-viewer-info">
        {photo.takenAt && (
          <div className="photo-info-item">
            <div className="photo-info-label">拍摄时间</div>
            <div className="photo-info-value">{formatDate(photo.takenAt)}</div>
          </div>
        )}
        {photo.locationName && (
          <div className="photo-info-item">
            <div className="photo-info-label">地点</div>
            <div className="photo-info-value">{photo.locationName}</div>
          </div>
        )}
        {photo.people && photo.people.length > 0 && (
          <div className="photo-info-item">
            <div className="photo-info-label">人物</div>
            <div className="photo-info-value">{photo.people.join(", ")}</div>
          </div>
        )}
        {photo.album && (
          <div className="photo-info-item">
            <div className="photo-info-label">相册</div>
            <div className="photo-info-value">{photo.album}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Category Card
function CategoryCard({
  name,
  count,
  coverPhotoId,
  icon,
  onClick,
}: {
  name: string;
  count: number;
  coverPhotoId?: string;
  icon?: string;
  onClick: () => void;
}) {
  return (
    <div className="category-card" onClick={onClick}>
      <div className="category-cover">
        {coverPhotoId ? (
          <img
            src={`/thumb/${coverPhotoId}`}
            alt=""
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          icon || "📁"
        )}
      </div>
      <div className="category-info">
        <div className="category-name">{name}</div>
        <div className="category-count">{count} 张照片</div>
      </div>
    </div>
  );
}

// Main App
function App() {
  const [view, setView] = useState<"stories" | "albums" | "people" | "locations">("stories");
  const [stats, setStats] = useState<Stats | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [viewerPhotos, setViewerPhotos] = useState<Photo[] | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Load initial data
  useEffect(() => {
    Promise.all([api.getStats(), api.getStories()])
      .then(([statsData, storiesData]) => {
        setStats(statsData);
        setStories(storiesData.stories || []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Load category data when switching views
  useEffect(() => {
    if (view === "albums" && albums.length === 0) {
      api.getAlbums().then(data => setAlbums(data.albums || []));
    } else if (view === "people" && people.length === 0) {
      api.getPeople().then(data => setPeople(data.people || []));
    } else if (view === "locations" && locations.length === 0) {
      api.getLocations().then(data => setLocations(data.locations || []));
    }
  }, [view, albums.length, people.length, locations.length]);

  // Refresh stories
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await api.refreshStories();
      setStories(data.stories || []);
    } finally {
      setRefreshing(false);
    }
  };

  // Open photo viewer
  const openPhotoViewer = (photo: Photo, index: number, photos: Photo[]) => {
    setViewerPhotos(photos);
    setViewerIndex(index);
  };

  // Load and show category photos
  const showAlbumPhotos = async (album: Album) => {
    const data = await api.getAlbumPhotos(album.id);
    if (data.photos && data.photos.length > 0) {
      setSelectedStory({
        id: `album-${album.id}`,
        type: "album",
        title: album.name,
        subtitle: `${data.photos.length} 张照片`,
        photos: data.photos,
      });
    }
  };

  const showPersonPhotos = async (person: Person) => {
    const data = await api.getPersonPhotos(person.name);
    if (data.photos && data.photos.length > 0) {
      setSelectedStory({
        id: `person-${person.id}`,
        type: "people_together",
        title: person.name,
        subtitle: `${data.photos.length} 张照片`,
        photos: data.photos,
      });
    }
  };

  const showLocationPhotos = async (location: Location) => {
    const data = await api.getLocationPhotos(location.name);
    if (data.photos && data.photos.length > 0) {
      setSelectedStory({
        id: `location-${location.name}`,
        type: "location",
        title: location.name,
        subtitle: `${data.photos.length} 张照片`,
        photos: data.photos,
      });
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <p>正在加载照片库...</p>
      </div>
    );
  }

  return (
    <>
      <header className="header">
        <div className="header-content">
          <div className="logo">Photo Memories</div>
          <nav className="nav">
            <button
              className={`nav-btn ${view === "stories" ? "active" : ""}`}
              onClick={() => setView("stories")}
            >
              故事
            </button>
            <button
              className={`nav-btn ${view === "albums" ? "active" : ""}`}
              onClick={() => setView("albums")}
            >
              相册
            </button>
            <button
              className={`nav-btn ${view === "people" ? "active" : ""}`}
              onClick={() => setView("people")}
            >
              人物
            </button>
            <button
              className={`nav-btn ${view === "locations" ? "active" : ""}`}
              onClick={() => setView("locations")}
            >
              地点
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        {stats && <StatsBar stats={stats} />}

        {view === "stories" && (
          <section className="stories-section">
            <div className="section-header">
              <h2 className="section-title">回忆故事</h2>
              <button className={`refresh-btn ${refreshing ? "spinning" : ""}`} onClick={handleRefresh}>
                <RefreshIcon />
                换一批故事
              </button>
            </div>

            {stories.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📷</div>
                <h3 className="empty-state-title">还没有照片</h3>
                <p>将照片放入 photos 目录后刷新页面</p>
              </div>
            ) : (
              <div className="stories-grid">
                {stories.map((story, index) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    featured={index === 0}
                    onClick={() => setSelectedStory(story)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {view === "albums" && (
          <div className="category-grid">
            {albums.map(album => (
              <CategoryCard
                key={album.id}
                name={album.name}
                count={album.photoCount}
                coverPhotoId={album.coverPhoto}
                onClick={() => showAlbumPhotos(album)}
              />
            ))}
          </div>
        )}

        {view === "people" && (
          <div className="category-grid">
            {people.map(person => (
              <CategoryCard
                key={person.id}
                name={person.name}
                count={person.photoCount}
                coverPhotoId={person.coverPhoto}
                icon="👤"
                onClick={() => showPersonPhotos(person)}
              />
            ))}
          </div>
        )}

        {view === "locations" && (
          <div className="category-grid">
            {locations.map(location => (
              <CategoryCard
                key={location.name}
                name={location.name}
                count={location.photoCount}
                icon="📍"
                onClick={() => showLocationPhotos(location)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Story Modal */}
      {selectedStory && (
        <StoryModal
          story={selectedStory}
          onClose={() => setSelectedStory(null)}
          onPhotoClick={(photo, index) => openPhotoViewer(photo, index, selectedStory.photos)}
        />
      )}

      {/* Photo Viewer */}
      {viewerPhotos && (
        <PhotoViewer
          photos={viewerPhotos}
          currentIndex={viewerIndex}
          onClose={() => setViewerPhotos(null)}
          onNavigate={setViewerIndex}
        />
      )}
    </>
  );
}

// Mount app
const root = createRoot(document.getElementById("root")!);
root.render(<App />);
