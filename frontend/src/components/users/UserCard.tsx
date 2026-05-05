import { User } from '@/api/users';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Play, Clock, Shield } from 'lucide-react';
import { formatWatchTime, getLastActiveText, getUserInitials } from '@/api/users';

interface UserCardProps {
  user: User;
  onClick?: () => void;
}

export default function UserCard({ user, onClick }: UserCardProps) {
  return (
    <Card
      className="hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-6">
        {/* User Info */}
        <div className="flex items-start gap-4 mb-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.avatar_url} alt={user.username} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {getUserInitials(user.username)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-lg truncate">{user.username}</h3>
              {user.is_admin && (
                <Badge variant="secondary" className="shrink-0">
                  <Shield className="h-3 w-3 mr-1" />
                  Admin
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {getLastActiveText(user)}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md">
              <Play className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Plays</p>
              <p className="font-semibold text-sm">{user.total_plays}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-md">
              <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Watch Time</p>
              <p className="font-semibold text-sm">{formatWatchTime(user.total_watch_time)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
