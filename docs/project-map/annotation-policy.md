# Annotation policy

Required: non-obvious lifecycle transitions, transaction/row-lock boundaries, preservation constraints, immutable published sources, non-mutating GETs, projection-not-source rules, and discard-not-delete semantics. Prohibited noise: obvious assignment, direct return, simple loop, or names already expressed by types/functions. This policy does not add runtime comments in stabilization.
