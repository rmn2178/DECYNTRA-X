from neo4j import AsyncGraphDatabase
from backend.config import settings

class Neo4jClient:
    def __init__(self):
        self.driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
            max_connection_pool_size=50
        )
    
    async def close(self):
        await self.driver.close()

neo4j_client = Neo4jClient()
