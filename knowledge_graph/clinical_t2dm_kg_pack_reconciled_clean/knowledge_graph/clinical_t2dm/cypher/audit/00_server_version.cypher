// READ ONLY. Record the Aura server version before migration. Static relationship seed files are intended to avoid dependence on dynamic relationship types.
CALL dbms.components() YIELD name, versions, edition
RETURN name, versions, edition;
