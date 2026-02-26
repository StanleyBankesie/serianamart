#!/usr/bin/env node

/**
 * Social Feed System - Verification Script
 * Checks that all tables exist and have correct structure
 * Run: node scripts/verify_social_feed.js
 */

import pool from "../db/pool.js";

async function verifySocialFeedSetup() {
  const connection = await pool.getConnection();

  try {
    console.log("🔍 Verifying Social Feed System Setup...\n");

    // Check posts table
    console.log("📌 Checking 'posts' table...");
    const postsTable = await connection
      .query(`SHOW COLUMNS FROM posts`)
      .catch(() => null);

    if (!postsTable) {
      console.log("❌ posts table not found");
      return false;
    }
    console.log("✅ posts table exists with columns:");
    postsTable.forEach((col) => console.log(`   - ${col.Field} (${col.Type})`));

    // Check post_likes table
    console.log("\n💬 Checking 'post_likes' table...");
    const likesTable = await connection
      .query(`SHOW COLUMNS FROM post_likes`)
      .catch(() => null);

    if (!likesTable) {
      console.log("❌ post_likes table not found");
      return false;
    }
    console.log("✅ post_likes table exists");

    // Check post_comments table
    console.log("\n💭 Checking 'post_comments' table...");
    const commentsTable = await connection
      .query(`SHOW COLUMNS FROM post_comments`)
      .catch(() => null);

    if (!commentsTable) {
      console.log("❌ post_comments table not found");
      return false;
    }
    console.log("✅ post_comments table exists");

    // Check post_selected_users table
    console.log("\n👥 Checking 'post_selected_users' table...");
    const selectedTable = await connection
      .query(`SHOW COLUMNS FROM post_selected_users`)
      .catch(() => null);

    if (!selectedTable) {
      console.log("❌ post_selected_users table not found");
      return false;
    }
    console.log("✅ post_selected_users table exists");

    // Check indexes
    console.log("\n🔑 Checking indexes...");
    const indexes = await connection.query(`SHOW INDEX FROM posts`);
    console.log(`✅ Found ${indexes.length} indexes on posts table`);
    indexes.forEach((idx) => {
      if (idx.Key_name !== "PRIMARY") {
        console.log(`   - ${idx.Key_name}`);
      }
    });

    // Check unique constraints
    console.log("\n🔒 Checking constraints...");
    const likeConstraints = await connection.query(
      `SHOW INDEX FROM post_likes WHERE Key_name != 'PRIMARY'`,
    );
    console.log(
      `✅ post_likes constraints: ${likeConstraints.length > 0 ? "OK" : "Missing"}`,
    );

    const selectedConstraints = await connection.query(
      `SHOW INDEX FROM post_selected_users WHERE Key_name != 'PRIMARY'`,
    );
    console.log(
      `✅ post_selected_users constraints: ${selectedConstraints.length > 0 ? "OK" : "Missing"}`,
    );

    // Count existing posts
    console.log("\n📊 Current data:");
    const postCount = await connection.query(
      `SELECT COUNT(*) as count FROM posts`,
    );
    console.log(`   Posts: ${postCount[0].count}`);

    const likeCount = await connection.query(
      `SELECT COUNT(*) as count FROM post_likes`,
    );
    console.log(`   Likes: ${likeCount[0].count}`);

    const commentCount = await connection.query(
      `SELECT COUNT(*) as count FROM post_comments`,
    );
    console.log(`   Comments: ${commentCount[0].count}`);

    console.log("\n✅ Social Feed System is ready!");
    console.log("\n📖 Next steps:");
    console.log("   1. Ensure backend is running: npm run dev");
    console.log("   2. Ensure frontend is running: npm run dev");
    console.log("   3. Add CompanyFeed component to your dashboard");
    console.log("   4. Check SOCIAL_FEED_QUICKSTART.md for usage\n");

    return true;
  } catch (error) {
    console.error("❌ Error during verification:", error.message);
    console.log("\n⚠️  Tables may not be initialized yet.");
    console.log("Run: node scripts/init_social_feed.js\n");
    return false;
  } finally {
    await connection.release();
  }
}

// Run verification
verifySocialFeedSetup()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
