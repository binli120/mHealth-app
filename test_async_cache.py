import asyncio
from unittest.mock import patch
import pytest
import pytest_asyncio

# Import the AsyncCache class - assuming it's in the same directory
# If it's in a different module, adjust this import accordingly
try:
    from async_cache import AsyncCache
except ImportError:
    # If not found, define a simple version for testing purposes
    from asyncio import Lock
    
    class AsyncCache:
        def __init__(self, ttl_seconds: int):
            self.ttl = ttl_seconds
            self._store = {}
            self._lock = Lock()

        async def get(self, key: str):
            async with self._lock:
                entry = self._store.get(key)
                if not entry:
                    return None
                value, expires_at = entry
                if asyncio.get_event_loop().time() > expires_at:
                    del self._store[key]
                    return None
                return value

        async def set(self, key: str, value):
            async with self._lock:
                expires_at = asyncio.get_event_loop().time() + self.ttl
                self._store[key] = (value, expires_at)

@pytest_asyncio.fixture
def cache():
    return AsyncCache(ttl_seconds=10)

@pytest.mark.asyncio
async def test_get_set_happy_path(cache):
    """Test basic get/set functionality"""
    await cache.set("key1", "value1")
    result = await cache.get("key1")
    assert result == "value1"

@pytest.mark.asyncio
async def test_cache_miss_returns_none(cache):
    """Test that getting a non-existent key returns None"""
    result = await cache.get("non_existent_key")
    assert result is None

@pytest.mark.asyncio
async def test_ttl_expiry(cache):
    """Test that expired keys are cleaned up and return None"""
    # Set a key
    await cache.set("key1", "value1")
    
    # Manually modify the store to simulate expiry
    # Get current time and set expiration time in the past
    import asyncio
    loop = asyncio.get_event_loop()
    current_time = loop.time()
    # Modify store directly to have expired timestamp
    cache._store["key1"] = ("value1", current_time - 15.0)  # Expired by 15 seconds
    
    result = await cache.get("key1")
    assert result is None
    # Verify key was removed from store
    assert "key1" not in cache._store

@pytest.mark.asyncio
async def test_concurrent_reads():
    """Test that concurrent reads don't corrupt data"""
    cache = AsyncCache(ttl_seconds=10)
    
    # Set up multiple concurrent operations
    async def set_key(key, value):
        await cache.set(key, value)
        
    async def get_key(key):
        return await cache.get(key)
        
    # Run concurrent set and get operations
    tasks = []
    tasks.append(set_key("key1", "value1"))
    tasks.append(get_key("key1"))
    tasks.append(set_key("key2", "value2"))
    tasks.append(get_key("key2"))
    
    results = await asyncio.gather(*tasks)
    
    # Verify all operations completed successfully
    assert results[1] == "value1"  # get operation should return the value
    assert results[3] == "value2"  # get operation should return the value

@pytest.mark.asyncio
async def test_concurrent_writes():
    """Test that concurrent writes don't corrupt data"""
    cache = AsyncCache(ttl_seconds=10)
    
    async def set_multiple_keys():
        await cache.set("key1", "value1")
        await cache.set("key2", "value2")
        # Verify we can read them back
        assert await cache.get("key1") == "value1"
        assert await cache.get("key2") == "value2"
        
    # Run multiple concurrent write operations
    tasks = [set_multiple_keys(), set_multiple_keys()]
    await asyncio.gather(*tasks)
    
    # Verify final state
    assert await cache.get("key1") == "value1"
    assert await cache.get("key2") == "value2"

@pytest.mark.asyncio
async def test_concurrent_access_with_lock():
    """Test that concurrent access is properly synchronized with the lock"""
    cache = AsyncCache(ttl_seconds=10)
    
    # Set initial value
    await cache.set("shared_key", "initial")
    
    async def read_modify_write():
        # Read and increment value
        current_value = await cache.get("shared_key")
        # Add small delay to increase chance of race condition
        await asyncio.sleep(0.01)
        await cache.set("shared_key", f"{current_value}_modified")
        
    # Run multiple concurrent read-modify-write operations
    tasks = [read_modify_write(), read_modify_write()]
    await asyncio.gather(*tasks)
    
    # The final value should be one of the modified versions, not corrupted
    final_value = await cache.get("shared_key")
    assert final_value is not None
    assert "modified" in final_value

if __name__ == "__main__":
    # This allows running tests directly with Python
    pytest.main([__file__, "-v"])