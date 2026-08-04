<?php
declare(strict_types=1);
require dirname(__DIR__) . '/src/common.php';
if (PHP_SAPI !== 'cli') exit(1);
$requested = $argv[1] ?? null; if ($requested !== null && $argc !== 2) { fwrite(STDERR,"Usage: php cms-api/scripts/reset-password.php [owner]\n"); exit(1); }
$authPath=path_private('auth.json'); if (!is_file($authPath)) { fwrite(STDERR,"Private auth storage is not initialized.\n"); exit(1); } $auth=read_json($authPath);
if ($requested !== null && (!isset($auth['username']) || !hash_equals((string)$auth['username'],$requested))) { fwrite(STDERR,"Requested owner does not match private auth record.\n"); exit(1); }
$password=getenv('CMS_RESET_PASSWORD') ?: ''; $confirm=$password;
if ($password === '') { fwrite(STDERR,'New password: '); shell_exec('stty -echo'); $password=rtrim((string)fgets(STDIN),"\r\n"); shell_exec('stty echo'); fwrite(STDERR,"\nConfirm password: "); shell_exec('stty -echo'); $confirm=rtrim((string)fgets(STDIN),"\r\n"); shell_exec('stty echo'); fwrite(STDERR,"\n"); }
if (strlen($password)<12 || $password!==$confirm) { fwrite(STDERR,"Password rejected.\n"); exit(1); }
$auth['passwordHash']=password_hash($password,PASSWORD_DEFAULT); atomic_json($authPath,$auth); revoke_all_tokens(); fwrite(STDOUT,"Owner password reset successfully.\nAll active sessions were revoked.\n");
