<?php
declare(strict_types=1);

const CMS_TOKEN_TTL_SECONDS = 28800;
const CMS_MAX_IMAGE_BYTES = 8_388_608;
const CMS_MAX_IMAGE_PIXELS = 24_000_000;

function repo_root(): string { return dirname(__DIR__, 2); }
function private_root(): string { return getenv('PORTFOLIO_PRIVATE_DATA_ROOT') ?: dirname(__DIR__) . '/private-dev'; }
function public_root(): string { return getenv('PORTFOLIO_PUBLIC_ROOT') ?: repo_root(); }
function path_private(string $path): string { return private_root() . '/' . $path; }
function json_response(int $status, array $body): never {
  http_response_code($status); header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff');
  echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit;
}
function api_error(int $status, string $code): never { json_response($status, ['code' => $code]); }
function allowed_origin(): string { return getenv('CMS_ALLOWED_ORIGIN') ?: 'http://127.0.0.1:5511'; }
function begin_api(array $methods): void {
  ini_set('display_errors', '0');
  $origin = $_SERVER['HTTP_ORIGIN'] ?? null;
  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    if ($origin !== allowed_origin()) api_error(403, 'ORIGIN_NOT_ALLOWED');
    header('Access-Control-Allow-Origin: ' . $origin); header('Vary: Origin'); header('Access-Control-Allow-Methods: ' . implode(', ', $methods)); header('Access-Control-Allow-Headers: Authorization, Content-Type'); header('Access-Control-Max-Age: 600'); http_response_code(204); exit;
  }
  if (!in_array($_SERVER['REQUEST_METHOD'], $methods, true)) { header('Allow: ' . implode(', ', $methods)); api_error(405, 'METHOD_NOT_ALLOWED'); }
  if ($origin !== null) {
    if ($origin !== allowed_origin()) api_error(403, 'ORIGIN_NOT_ALLOWED');
    header('Access-Control-Allow-Origin: ' . $origin); header('Vary: Origin');
  } elseif (getenv('CMS_API_ALLOW_ORIGINLESS_TESTS') !== '1') api_error(403, 'ORIGIN_REQUIRED');
}
function require_json_body(): array {
  if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) api_error(415, 'INVALID_CONTENT_TYPE');
  $raw = file_get_contents('php://input'); if ($raw === false || strlen($raw) > 32_768) api_error(422, 'INVALID_REQUEST');
  try { $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR); } catch (Throwable) { api_error(422, 'INVALID_JSON'); }
  if (!is_array($data)) api_error(422, 'INVALID_REQUEST'); return $data;
}
function read_json(string $path): array {
  $raw = @file_get_contents($path); if ($raw === false) throw new RuntimeException('private storage unavailable');
  $value = json_decode($raw, true); if (!is_array($value)) throw new RuntimeException('private storage corrupt'); return $value;
}
function atomic_json(string $path, array $value): void {
  $dir = dirname($path); if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) throw new RuntimeException('storage directory unavailable');
  $tmp = tempnam($dir, '.tmp-'); if ($tmp === false) throw new RuntimeException('temporary write unavailable');
  try { $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT); if (file_put_contents($tmp, $json . "\n", LOCK_EX) === false || !rename($tmp, $path)) throw new RuntimeException('atomic write failed'); chmod($path, 0600); } finally { if (is_file($tmp)) @unlink($tmp); }
}
function with_state_lock(callable $operation): mixed {
  $locks = path_private('locks'); if (!is_dir($locks) && !mkdir($locks, 0700, true) && !is_dir($locks)) throw new RuntimeException('lock storage unavailable');
  $handle = fopen($locks . '/state.lock', 'c'); if (!$handle || !flock($handle, LOCK_EX)) throw new RuntimeException('state lock unavailable');
  try { return $operation(); } finally { flock($handle, LOCK_UN); fclose($handle); }
}
function token_hash(string $token): string { return hash('sha256', $token); }
function token_records(): array { $path = path_private('tokens.json'); return is_file($path) ? read_json($path) : ['tokens' => []]; }
function write_tokens(array $records): void { atomic_json(path_private('tokens.json'), $records); }
function require_auth(): array {
  $header = $_SERVER['HTTP_AUTHORIZATION'] ?? ''; if (!preg_match('/^Bearer ([a-f0-9]{64})$/D', $header, $matches)) api_error(401, 'UNAUTHORIZED');
  $hash = token_hash($matches[1]); $records = token_records(); $now = time(); $active = null; $kept = [];
  foreach (($records['tokens'] ?? []) as $record) { if (!is_array($record) || !isset($record['hash'], $record['expiresAt']) || strtotime((string)$record['expiresAt']) <= $now) continue; $kept[] = $record; if (hash_equals((string)$record['hash'], $hash)) $active = $record; }
  if (count($kept) !== count($records['tokens'] ?? [])) write_tokens(['tokens' => $kept]); if ($active === null) api_error(401, 'UNAUTHORIZED'); return ['hash' => $hash, 'records' => $kept];
}
function revoke_token(string $hash): void { $records = token_records(); $records['tokens'] = array_values(array_filter($records['tokens'] ?? [], fn($record) => !is_array($record) || !hash_equals((string)($record['hash'] ?? ''), $hash))); write_tokens($records); }
function revoke_all_tokens(): void { write_tokens(['tokens' => []]); }
function is_text_pair(mixed $value, bool $required): bool { return is_array($value) && isset($value['ru'], $value['en']) && is_string($value['ru']) && is_string($value['en']) && (!$required || (trim($value['ru']) !== '' && trim($value['en']) !== '')); }
function is_list_pair(mixed $value, bool $required): bool { if (!is_array($value) || !isset($value['ru'],$value['en']) || !is_array($value['ru']) || !is_array($value['en']) || count($value['ru']) !== count($value['en'])) return false; foreach ([...$value['ru'], ...$value['en']] as $item) if (!is_string($item) || ($required && trim($item)==='')) return false; return !$required || count($value['ru'])>0; }
function safe_src(mixed $src): bool { return is_string($src) && preg_match('#^/?images/[a-zA-Z0-9._/-]+$#D', $src) === 1 && !str_contains($src, '..'); }
function valid_state(array $state): bool {
  if (!isset($state['version']) || !is_int($state['version']) || $state['version'] < 1 || !isset($state['projects']) || !is_array($state['projects'])) return false;
  $ids = []; foreach ($state['projects'] as $project) { if (!is_array($project) || !isset($project['id'], $project['status'], $project['order'], $project['gallery']) || !is_string($project['id']) || preg_match('/^[a-z0-9][a-z0-9-]{1,80}$/D', $project['id']) !== 1 || isset($ids[$project['id']]) || !in_array($project['status'], ['draft','published'], true) || !is_int($project['order']) || $project['order'] < 0 || !is_array($project['gallery'])) return false; $ids[$project['id']] = true; $published = $project['status'] === 'published';
    foreach (['category','title','role','statusLabel'] as $key) if (!is_text_pair($project[$key] ?? null, $published)) return false;
    foreach (['description','features','notes'] as $key) if (!is_list_pair($project[$key] ?? null, $published && $key !== 'notes')) return false;
    if (!is_array($project['techStack'] ?? null) || array_filter($project['techStack'], fn($x) => !is_string($x) || trim($x)==='') || !is_array($project['links'] ?? null)) return false;
    foreach ($project['links'] as $link) { if (!is_array($link) || !is_text_pair($link['label'] ?? null,$published) || !is_string($link['url'] ?? null) || (!str_starts_with($link['url'],'https://') && !preg_match('/^#[A-Za-z][A-Za-z0-9_-]*$/D',$link['url'])) || !in_array($link['target'] ?? null,['_blank','_self'],true)) return false; }
    $mediaIds = []; foreach (['desktop','mobile'] as $kind) { if (!is_array($project['gallery'][$kind] ?? null)) return false; foreach ($project['gallery'][$kind] as $media) { if (!is_array($media) || !isset($media['id'],$media['src'],$media['presentation']) || !is_string($media['id']) || !preg_match('/^[A-Za-z0-9][A-Za-z0-9-]{1,100}$/D',$media['id']) || isset($mediaIds[$media['id']]) || !safe_src($media['src']) || !in_array($media['presentation'],['cover','contain'],true) || !is_text_pair($media['alt'] ?? null,$published) || !is_text_pair($media['ariaLabel'] ?? null,$published)) return false; $mediaIds[$media['id']] = true; } }
  } return true;
}
function fill_media_labels(array &$state): void { foreach ($state['projects'] as &$project) foreach (['desktop','mobile'] as $kind) foreach ($project['gallery'][$kind] as &$media) foreach (['ru','en'] as $locale) if (($media['ariaLabel'][$locale] ?? '') === '' && isset($media['alt'][$locale])) $media['ariaLabel'][$locale] = $media['alt'][$locale]; }
function project_media_ref(array $state): array { $refs=[]; foreach ($state['projects'] as $p) foreach (['desktop','mobile'] as $k) foreach ($p['gallery'][$k] as $m) $refs[ltrim($m['src'],'/')] = true; return $refs; }
function publish_projection(array $state): array { return ['version' => $state['version'], 'projects' => array_values(array_filter($state['projects'], fn($p) => $p['status'] === 'published'))]; }
function write_projection(array $state): void { $path=public_root() . '/data/projects.lite.json'; atomic_json($path, publish_projection($state)); if (!chmod($path, 0644)) throw new RuntimeException('projection permissions unavailable'); }
function backup_state(array $current): void { $dir = path_private('backups'); if (!is_dir($dir)) mkdir($dir,0700,true); atomic_json($dir . '/projects-v' . $current['version'] . '-' . gmdate('YmdHis') . '.json', $current); $files=glob($dir.'/projects-v*.json') ?: []; rsort($files); foreach (array_slice($files,20) as $file) @unlink($file); }
function mime_extension(string $tmp): array { $mime=(new finfo(FILEINFO_MIME_TYPE))->file($tmp); $allowed=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp']; if (!isset($allowed[$mime]) || @getimagesize($tmp) === false) api_error(415,'INVALID_IMAGE_TYPE'); [$w,$h]=getimagesize($tmp); if ($w*$h > CMS_MAX_IMAGE_PIXELS) api_error(422,'INVALID_IMAGE_DIMENSIONS'); return [$mime,$allowed[$mime]]; }
function move_orphan_to_quarantine(string $src): void { $relative=ltrim($src,'/'); if (!safe_src($relative)) return; $from=public_root().'/'.$relative; if (!is_file($from)) return; $dir=path_private('quarantine/'.gmdate('Ymd')); if (!is_dir($dir)) mkdir($dir,0700,true); @rename($from,$dir.'/'.bin2hex(random_bytes(8)).'-'.basename($from)); }
