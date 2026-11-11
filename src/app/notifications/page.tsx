import { prisma } from "@/lib/database/prisma";
import { pageUser } from "@/lib/auth/page";
import { NotificationList } from "@/components/notifications/NotificationList";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await pageUser("/notifications");
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <div className="container-page py-12 md:py-16">
      <NotificationList
        items={notifications.map((item) => ({
          id: item.id,
          readingId: item.readingId,
          title: item.title,
          body: item.body,
          readAt: item.readAt?.toISOString() ?? null,
          createdAt: item.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
