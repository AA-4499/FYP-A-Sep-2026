// DESTRUCTIVE. RUN ONLY AFTER EVERY AUDIT QUERY HAS BEEN REVIEWED AND A PRIVATE BACKUP EXISTS.
// Removes all current relationships so old experimental/patient/event edges cannot survive the reseed.
MATCH ()-[r]->()
DELETE r;
