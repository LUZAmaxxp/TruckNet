$ docker run --name my-postgres \
  -e POSTGRES_USER=AymanALLOUCH \
  -e POSTGRES_PASSWORD=aymanos007 \
  -e POSTGRES_DB=TruckNET \
  -p 5432:5432 \
  -v pgdata:/var/lib/postgresql/data \
  -d postgres:16