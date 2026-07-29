SELECT
  COUNT(DISTINCT CASE WHEN name = 'visited' THEN session_hash END) AS users,
  COUNT(DISTINCT CASE WHEN name = 'editor_started' THEN session_hash END) AS editors,
  COUNT(DISTINCT CASE WHEN name = 'sheet_imported' THEN session_hash END) AS importers,
  COUNT(DISTINCT CASE WHEN name = 'sheet_saved' THEN session_hash END) AS savers,
  COUNT(DISTINCT CASE WHEN name = 'share_copied' THEN session_hash END) AS sharers,
  COUNT(DISTINCT CASE WHEN name = 'ccfolia_copied' THEN session_hash END) AS ccfolia_users,
  COUNT(DISTINCT CASE WHEN name = 'json_exported' THEN session_hash END) AS exporters,
  COUNT(DISTINCT CASE WHEN name = 'returned' THEN session_hash END) AS returned_users,
  COUNT(DISTINCT CASE WHEN name = 'visited' AND created_at >= unixepoch() - 604800 THEN session_hash END) AS users_7d,
  COUNT(DISTINCT CASE WHEN name = 'sheet_saved' AND created_at >= unixepoch() - 604800 THEN session_hash END) AS savers_7d,
  COUNT(CASE WHEN name = 'sheet_imported' THEN 1 END) AS import_actions,
  COUNT(CASE WHEN name = 'sheet_saved' THEN 1 END) AS save_actions,
  COUNT(CASE WHEN name = 'share_copied' THEN 1 END) AS share_actions,
  COUNT(CASE WHEN name = 'ccfolia_copied' THEN 1 END) AS ccfolia_actions,
  (SELECT COUNT(*) FROM sheets) AS published_sheets
FROM product_events
WHERE is_automated = 0;
