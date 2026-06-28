import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")

        # Reject connection if user is anonymous/not authenticated
        if not self.user or self.user.is_anonymous:
            await self.close(code=4001)  # Custom close code for unauthorized
            return

        self.group_name = f"user_{self.user.id}"

        # Join user-specific notification group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    # Receive notification payload from the channel layer group and send to websocket
    async def send_notification(self, event):
        payload = event.get("payload", {})
        await self.send_json(payload)
