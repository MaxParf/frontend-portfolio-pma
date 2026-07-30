# Media map

`media_assets`, translations, variants and `project_media` provide asset identity and project references; locale publication media stores immutable publication-owned references. `modules/media` handles upload and variant reads, while publication materialization and verifier scripts protect projection integrity and orphans. Docker storage is mounted by compose; do not remove volumes. Draft/source changes must preserve managed asset identity and avoid deleting publication-referenced media.
