import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listUsers } from '@/api/users';
import { User } from '@/api/users';
import UserCard from '@/components/users/UserCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, SortAsc, SortDesc, RefreshCw } from 'lucide-react';
import { ErrorAlert, LoadingState, EmptyState } from '@/components/ui/Alerts';

type SortField = 'username' | 'plays' | 'watch_time' | 'last_active';

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('username');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);
      const data = await listUsers();
      setUsers(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load users. Please check your connection and try again.';
      setError(errorMessage);
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filter users by search query
  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort users
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'username':
        comparison = a.username.localeCompare(b.username);
        break;
      case 'plays':
        comparison = a.total_plays - b.total_plays;
        break;
      case 'watch_time':
        comparison = a.total_watch_time - b.total_watch_time;
        break;
      case 'last_active':
        const aDate = a.last_active ? new Date(a.last_active).getTime() : 0;
        const bDate = b.last_active ? new Date(b.last_active).getTime() : 0;
        comparison = aDate - bDate;
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground mt-1">
            {users.length} {users.length === 1 ? 'user' : 'users'} registered
          </p>
        </div>

        <Button onClick={loadUsers} variant="outline" disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <ErrorAlert
          title="Unable to load users"
          message={error}
          onRetry={loadUsers}
          onDismiss={() => setError(null)}
        />
      )}

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 min-h-[44px]"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant={sortField === 'username' ? 'default' : 'outline'}
            onClick={() => handleSort('username')}
            size="sm"
            className="min-h-[44px] touch-target"
          >
            Name
            {sortField === 'username' && (
              sortOrder === 'asc' ? (
                <SortAsc className="ml-1 h-4 w-4" />
              ) : (
                <SortDesc className="ml-1 h-4 w-4" />
              )
            )}
          </Button>
          <Button
            variant={sortField === 'plays' ? 'default' : 'outline'}
            onClick={() => handleSort('plays')}
            size="sm"
            className="min-h-[44px] touch-target"
          >
            Plays
            {sortField === 'plays' && (
              sortOrder === 'asc' ? (
                <SortAsc className="ml-1 h-4 w-4" />
              ) : (
                <SortDesc className="ml-1 h-4 w-4" />
              )
            )}
          </Button>
          <Button
            variant={sortField === 'watch_time' ? 'default' : 'outline'}
            onClick={() => handleSort('watch_time')}
            size="sm"
            className="min-h-[44px] touch-target"
          >
            Watch Time
            {sortField === 'watch_time' && (
              sortOrder === 'asc' ? (
                <SortAsc className="ml-1 h-4 w-4" />
              ) : (
                <SortDesc className="ml-1 h-4 w-4" />
              )
            )}
          </Button>
          <Button
            variant={sortField === 'last_active' ? 'default' : 'outline'}
            onClick={() => handleSort('last_active')}
            size="sm"
            className="min-h-[44px] touch-target"
          >
            Last Active
            {sortField === 'last_active' && (
              sortOrder === 'asc' ? (
                <SortAsc className="ml-1 h-4 w-4" />
              ) : (
                <SortDesc className="ml-1 h-4 w-4" />
              )
            )}
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <LoadingState message="Loading users..." />
      ) : /* Empty State */
      sortedUsers.length === 0 ? (
        <EmptyState
          icon={<Search className="h-12 w-12" />}
          title={searchQuery ? 'No users match your search' : 'No users found'}
          description={searchQuery ? 'Try adjusting your search criteria' : 'Get started by inviting users to your server'}
        />
      ) : (
        /* User Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedUsers.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              onClick={() => navigate(`/users/${user.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
