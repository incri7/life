/**
 * Notification Service
 * Manages browser notification permissions and triggers.
 */

export const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
        console.warn("This browser does not support desktop notification");
        return false;
    }

    if (Notification.permission === "granted") {
        return true;
    }

    if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        return permission === "granted";
    }

    return false;
};

export const showLocalNotification = async (title, body) => {
    if (!("Notification" in window) || Notification.permission !== "granted") {
        return;
    }

    // Try through Service Worker for better PWA support
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        const registration = await navigator.serviceWorker.ready;
        registration.showNotification(title, {
            body,
            icon: '/logo.png',
            badge: '/logo.png',
            vibrate: [200, 100, 200],
            tag: 'task-reminder',
            renotify: true,
            data: {
                url: window.location.origin
            }
        });
    } else {
        // Fallback to standard Notification API
        new Notification(title, { body, icon: '/logo.png' });
    }
};
