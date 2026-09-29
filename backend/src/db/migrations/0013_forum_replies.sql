-- Replies to forum threads.
--
-- The forum showed a reply count from the start, but nothing ever wrote a reply:
-- forum_threads.replies was a number the demo seed set and nothing else touched.
-- Replies are rows here now, and the count the API returns is COUNT(*) over this
-- table. forum_threads.replies is no longer read; it stays because dropping a
-- column is not something a retried migration can safely half-do.
--
-- (thread_id, created_at) serves the one read: a thread's replies in order.
-- CREATE TABLE IF NOT EXISTS keeps this file re-runnable, and the index is
-- declared inline so it is created with the table or not at all.
CREATE TABLE IF NOT EXISTS forum_replies (
  id             VARCHAR(64) NOT NULL PRIMARY KEY,
  thread_id      VARCHAR(64) NOT NULL,
  author_user_id VARCHAR(64) NOT NULL,
  body           TEXT        NOT NULL,
  created_at     VARCHAR(40) NOT NULL,
  KEY idx_forum_replies_thread_created (thread_id, created_at),
  CONSTRAINT fk_forumreply_thread FOREIGN KEY (thread_id)      REFERENCES forum_threads(id),
  CONSTRAINT fk_forumreply_author FOREIGN KEY (author_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
