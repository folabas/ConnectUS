import cron from 'node-cron';
import { Room } from '../models/Room';
import type { Server } from 'socket.io';

let io: Server;

class SchedulerService {
    private task: any | null = null;
    
    setIo(ioInstance: Server) {
        io = ioInstance;
    }

    start() {
        // Run every minute to check for scheduled rooms
        this.task = cron.schedule('* * * * *', async () => {
            try {
                await this.checkScheduledRooms();
            } catch (error) {
                console.error('Scheduler error:', error);
            }
        });

        console.log('Room scheduler started');
    }

    stop() {
        if (this.task) {
            this.task.stop();
            console.log('Room scheduler stopped');
        }
    }

    private async checkScheduledRooms() {
        const now = new Date();
        const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

        // Find rooms that are scheduled and not yet started
        const scheduledRooms = await Room.find({
            scheduledStartTime: { $exists: true, $ne: null },
            status: 'scheduled'
        }).populate('host participants');

        for (const room of scheduledRooms) {
            const startTime = new Date(room.scheduledStartTime!);

            // Check if it's time to start the room
            if (startTime <= now) {
                await this.activateRoom(room);
            }
            // Check if we should send 10-minute notification
            else if (startTime <= tenMinutesFromNow && !room.notificationSent) {
                await this.sendTenMinuteNotification(room);
            }
        }
    }

    private async activateRoom(room: any) {
        try {
            // Update room status to active
            room.status = 'active';
            await room.save();

            // Notify all participants in the room
            io.to(room._id.toString()).emit('room-started', {
                roomId: room._id,
                message: 'The room has started! Get ready to watch.',
                room: room
            });

            console.log(`Room ${room._id} activated at scheduled time`);
        } catch (error) {
            console.error(`Error activating room ${room._id}:`, error);
        }
    }

    private async sendTenMinuteNotification(room: any) {
        try {
            // Mark notification as sent
            room.notificationSent = true;
            await room.save();

            // Notify all participants
            io.to(room._id.toString()).emit('room-starting-soon', {
                roomId: room._id,
                message: 'Room starts in 10 minutes!',
                startTime: room.scheduledStartTime
            });

            console.log(`10-minute notification sent for room ${room._id}`);
        } catch (error) {
            console.error(`Error sending notification for room ${room._id}:`, error);
        }
    }
}

export const schedulerService = new SchedulerService();
