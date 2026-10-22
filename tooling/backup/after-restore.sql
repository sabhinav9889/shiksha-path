-- Run once after restoring a backup into a different database server (a new project, a move).
-- Each event remembers the transaction that wrote it (`tx_id`), and a pull only returns events
-- from transactions older than every running one. A new server counts transactions from a low
-- number again, so every restored event would look "not yet committed" and no phone would get
-- it. Marking them as written by the oldest possible transaction makes them visible again.
update public.learner_events set tx_id = '3'::xid8;
