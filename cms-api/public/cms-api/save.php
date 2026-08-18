<?php
require dirname(__DIR__, 2) . '/src/common.php'; begin_api(['POST']);
try { $auth=require_auth(); if (!isset($_POST['state'],$_POST['pendingMedia'])) api_error(422,'INVALID_REQUEST'); $state=json_decode((string)$_POST['state'],true); $pending=json_decode((string)$_POST['pendingMedia'],true); if (!is_array($state)||!is_array($pending)||!isset($state['baseVersion'],$state['projects'])||!is_int($state['baseVersion'])) api_error(422,'INVALID_REQUEST');
  $result=with_state_lock(function() use ($state,$pending) {
    $current=read_json(path_private('projects.json')); if ($current['version'] !== $state['baseVersion']) { json_response(409,['code'=>'STATE_VERSION_CONFLICT','currentVersion'=>$current['version']]); }
    $next=['version'=>$current['version']+1,'projects'=>$state['projects']]; $uploads=$_FILES['uploads'] ?? null; $created=[];
    foreach ($pending as $item) {
      if (!is_array($item)||!isset($item['id'],$item['projectId'],$item['galleryKind'],$item['alt'],$item['presentation'])||!is_string($item['id'])||!is_string($item['projectId'])||!in_array($item['galleryKind'],['desktop','mobile'],true)) api_error(422,'INVALID_MEDIA_MAPPING');
      $file=$uploads['error'][$item['id']] ?? null; $tmp=$uploads['tmp_name'][$item['id']] ?? null; $size=$uploads['size'][$item['id']] ?? null; if ($file !== UPLOAD_ERR_OK || !is_string($tmp) || !is_uploaded_file($tmp) || !is_int($size) || $size<1 || $size>CMS_MAX_IMAGE_BYTES) api_error(413,'IMAGE_TOO_LARGE');
      [$mime,$ext]=mime_extension($tmp); $projectIndex=null; foreach ($next['projects'] as $candidateIndex=>$project) if ($project['id']===$item['projectId']) { $projectIndex=$candidateIndex; break; } if ($projectIndex===null) api_error(422,'INVALID_MEDIA_MAPPING');
      $group=&$next['projects'][$projectIndex]['gallery'][$item['galleryKind']]; $index=null; foreach ($group as $i=>$media) if (($media['id']??null)===$item['id']) { $index=$i; break; }
      if ($index===null) { $group[]=['id'=>$item['id'],'src'=>'images/projects/'.$item['projectId'].'/pending.'.$ext,'alt'=>$item['alt'],'ariaLabel'=>$item['ariaLabel']??['ru'=>'','en'=>''],'presentation'=>$item['presentation']]; $index=array_key_last($group); }
      $dir=public_root().'/images/projects/'.$item['projectId']; if (!is_dir($dir) && !mkdir($dir,0755,true) && !is_dir($dir)) throw new RuntimeException('media directory unavailable'); $name=bin2hex(random_bytes(16)).'.'.$ext; $destination=$dir.'/'.$name; if (!move_uploaded_file($tmp,$destination)) throw new RuntimeException('media move failed'); $created[]=$destination; $group[$index]['src']='/images/projects/'.$item['projectId'].'/'.$name;
    }
    fill_media_labels($next); if (!valid_state($next)) { foreach($created as $file) @unlink($file); api_error(422,'VALIDATION_ERROR'); }
    try { backup_state($current); atomic_json(path_private('projects.json'),$next); try { write_projection($next); } catch(Throwable $e) { throw new RuntimeException('projection write failed'); } $old=project_media_ref($current); $new=project_media_ref($next); foreach(array_keys($old) as $src) if (!isset($new[$src])) move_orphan_to_quarantine($src); return $next; } catch(Throwable $e) { throw $e; }
  }); json_response(200,$result);
} catch (Throwable) { api_error(500,'SAVE_FAILED'); }
