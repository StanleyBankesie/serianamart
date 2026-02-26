import React from "react";
import PostCard from "./PostCard";
import "./PostList.css";

export default function PostList({
  posts,
  setPosts,
  defaultShowComments = false,
  forceOpenComments = false,
}) {
  return (
    <div className="post-list">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          setPosts={setPosts}
          defaultShowComments={defaultShowComments}
          forceOpenComments={forceOpenComments}
        />
      ))}
    </div>
  );
}
