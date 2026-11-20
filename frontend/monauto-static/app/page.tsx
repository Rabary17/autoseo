import { getAllPosts, resolveCoverImage } from "@/lib/posts";
import { getCategory } from "@/lib/categories";

export default function HomePage() {
  const posts = getAllPosts().filter((p) => p.locale === "fr");
  return (
    <div>
      <h1>Derniers articles</h1>
      <div className="card-grid">
        {posts.slice(0, 60).map((post) => {
          const cover = resolveCoverImage(post);
          const categorie = post.category ? getCategory(post.category) : undefined;
          return (
            <a key={post.slug} className="card" href={`/${post.slug}/`}>
              <img src={cover.src} alt={cover.alt} loading="lazy" />
              <div className="card-body">
                {categorie ? <span className="tag">{categorie.title}</span> : null}
                <p className="card-title">{post.title}</p>
                <p className="card-meta">{post.date}</p>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
