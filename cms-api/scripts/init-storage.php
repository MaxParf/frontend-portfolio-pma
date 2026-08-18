<?php
declare(strict_types=1);
require dirname(__DIR__) . '/src/common.php';
if (PHP_SAPI !== 'cli') exit(1); $username=$argv[1]??''; if (!preg_match('/^[^\s]{1,120}$/',$username)) { fwrite(STDERR,"Usage: php cms-api/scripts/init-storage.php <username>\n"); exit(1); }
$private=private_root(); if (is_file($private.'/auth.json') || is_file($private.'/projects.json')) { fwrite(STDERR,"Private storage already initialized.\n"); exit(1); }
foreach (['','backups','quarantine','locks'] as $dir) if (!is_dir($private.'/'.$dir) && !mkdir($private.'/'.$dir,0700,true) && !is_dir($private.'/'.$dir)) exit(1);
$password=getenv('CMS_BOOTSTRAP_PASSWORD') ?: ''; $confirm=$password;
if ($password === '') { fwrite(STDERR,'New password: '); shell_exec('stty -echo'); $password=rtrim((string)fgets(STDIN),"\r\n"); shell_exec('stty echo'); fwrite(STDERR,"\nConfirm password: "); shell_exec('stty -echo'); $confirm=rtrim((string)fgets(STDIN),"\r\n"); shell_exec('stty echo'); fwrite(STDERR,"\n"); }
if (strlen($password)<12 || $password!==$confirm) { fwrite(STDERR,"Password rejected.\n"); exit(1); }
$fixture=repo_root().'/data/projects.lite.json'; atomic_json($private.'/projects.json',read_json($fixture)); atomic_json($private.'/auth.json',['username'=>$username,'passwordHash'=>password_hash($password,PASSWORD_DEFAULT)]); atomic_json($private.'/tokens.json',['tokens'=>[]]); fwrite(STDOUT,"Private CMS Lite storage initialized.\n");
