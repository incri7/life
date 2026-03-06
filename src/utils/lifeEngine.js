/**
 * Life RPG Engine
 * Handles parsing life.md and managing XP, Levels, and Adaptive Scheduling.
 */

export const parseLifeMD = (content) => {
    const lines = content.split('\n')
    const schedule = { fixed: [], flexible: [] }

    // XP map for specific keywords
    const xpMap = {
        'skill building': 75,
        'screens off': 25,
        'sleep': 25
    }

    let currentSection = 'none'

    lines.forEach(line => {
        const trimmed = line.trim()
        if (!trimmed) return

        const lower = trimmed.toLowerCase()

        // Section Detection via markdown headers
        if (lower.includes('morning protocol')) { currentSection = 'morning'; return }
        if (lower.includes('evening protocol')) { currentSection = 'evening'; return }
        if (trimmed.startsWith('#') && !lower.includes('protocol')) { currentSection = 'none'; return }

        if (currentSection === 'none') return

        // Match time lines: "05:00 Wake up" or "18:00 Dinner"
        const timeMatch = trimmed.match(/^(\d{1,2}:\d{2})\s+(.+)$/)
        if (timeMatch) {
            let [_, time, activity] = timeMatch
            const [h, m] = time.split(':').map(Number)
            const formattedTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`

            // Determine period
            let period = 'Morning'
            if (h >= 12 && h < 17) period = 'Afternoon'
            if (h >= 17 || h < 4) period = 'Evening'

            // XP based on keywords or section
            let xp = 50
            const actLower = activity.toLowerCase()
            for (const [key, val] of Object.entries(xpMap)) {
                if (actLower.includes(key)) { xp = val; break }
            }

            // No duplicates
            if (!schedule.fixed.find(t => t.time === formattedTime)) {
                schedule.fixed.push({
                    time: formattedTime,
                    activity: activity.trim(),
                    type: 'fixed',
                    xp,
                    period
                })
            }
        }
    })

    return schedule
}

export const calculateLevel = (totalXp) => {
    // Simple quadratic leveling: Level = sqrt(XP / 100)
    return Math.floor(Math.sqrt(totalXp / 100)) + 1;
};

export const getXpForNextLevel = (level) => {
    return Math.pow(level, 2) * 100;
};

/**
 * The Oracle Logic
 * Re-adjusts schedule based on user input.
 */
export const adjustSchedule = (schedule, userInput, currentTime) => {
    const intent = userInput.toLowerCase();

    if (intent.includes('early') || intent.includes('fast')) {
        return {
            message: "Tactical advantage gained. Moving up next objective.",
            action: "accelerate"
        };
    }

    if (intent.includes('tired') || intent.includes('slow')) {
        return {
            message: "Stamina low. Re-routing non-essential blocks to recovery.",
            action: "recovery_mode"
        };
    }

    return {
        message: "Data logged. No immediate tactical shift required.",
        action: "none"
    };
};
