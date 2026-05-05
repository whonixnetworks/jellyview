import { UserDevice } from '@/api/users';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Monitor, Smartphone, Tv, Laptop, Tablet } from 'lucide-react';

interface UserDeviceListProps {
  devices: UserDevice[];
}

function getDeviceIcon(device: string, client: string) {
  const deviceLower = device.toLowerCase();
  const clientLower = client.toLowerCase();

  if (deviceLower.includes('tv') || deviceLower.includes('chromecast')) {
    return Tv;
  }
  if (deviceLower.includes('phone') || deviceLower.includes('mobile')) {
    return Smartphone;
  }
  if (deviceLower.includes('tablet') || deviceLower.includes('ipad')) {
    return Tablet;
  }
  if (deviceLower.includes('laptop') || deviceLower.includes('macbook') || clientLower.includes('web')) {
    return Laptop;
  }
  return Monitor;
}

function getLastSeenText(lastSeen: string): string {
  const lastSeenDate = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - lastSeenDate.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 30) {
    return `${diffDays}d ago`;
  } else {
    return lastSeenDate.toLocaleDateString();
  }
}

export default function UserDeviceList({ devices }: UserDeviceListProps) {
  if (devices.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No devices found for this user
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Known Devices & IP Addresses</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {devices.map((device) => {
            const DeviceIcon = getDeviceIcon(device.device, device.client);
            return (
              <div
                key={device.id}
                className="flex items-start gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="p-2 bg-primary/10 rounded-lg">
                  <DeviceIcon className="h-5 w-5 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold truncate">{device.client}</h4>
                    <Badge variant="outline" className="text-xs">
                      {device.play_count} {device.play_count === 1 ? 'play' : 'plays'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{device.device}</p>

                  <div className="flex items-center gap-4 text-sm">
                    {device.ip_address && (
                      <span className="font-mono text-muted-foreground">
                        {device.ip_address}
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      Last seen {getLastSeenText(device.last_seen)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
