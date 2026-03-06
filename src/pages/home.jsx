import React, { useState, useEffect, useRef } from 'react'
import {
    Box,
    Container,
    Heading,
    Text,
    VStack,
    HStack,
    Progress,
    Button,
    IconButton,
    Tabs,
    TabList,
    TabPanels,
    Tab,
    TabPanel,
    Icon,
    useColorModeValue,
    Circle,
    Divider,
    Drawer,
    DrawerBody,
    DrawerHeader,
    DrawerOverlay,
    DrawerContent,
    DrawerCloseButton,
    useDisclosure,
    Input,
    InputGroup,
    InputRightElement,
    Avatar,
    Badge,
    Stat,
    StatLabel,
    StatNumber,
    StatHelpText,
    SimpleGrid,
    useBreakpointValue,
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
    FormControl, FormLabel, NumberInput, NumberInputField, NumberInputStepper, NumberIncrementStepper, NumberDecrementStepper
} from '@chakra-ui/react'
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import { FiPlus, FiTrash2, FiEdit2, FiCheckCircle, FiClock, FiMessageSquare, FiTrendingUp, FiSettings, FiActivity, FiSearch, FiSend, FiX, FiCheck, FiLayout, FiAward, FiUser, FiZap } from 'react-icons/fi'
import { calculateLevel, getXpForNextLevel } from '../utils/lifeEngine'
import { getOracleResponse } from '../utils/oracleAgent'

const MotionBox = motion.create(Box)

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1"
const USERNAME = "incri"

export function Home() {
    // Persistence Layer (Switched to API)
    const [level, setLevel] = useState(1)
    const [xp, setXp] = useState(0)
    const [completedQuests, setCompletedQuests] = useState([])
    const [customTasks, setCustomTasks] = useState([])
    const [processStats, setProcessStats] = useState({ days: 0, weeks: 0, months: 0, years: 0 })
    const [progress, setProgress] = useState({ streak: 0, total_days_active: 0, total_tasks_completed: 0, history: [] })

    const [schedule, setSchedule] = useState({ fixed: [], flexible: [] })
    const [activeQuest, setActiveQuest] = useState(null)
    const { isOpen: isOracleOpen, onOpen: onOracleOpen, onClose: onOracleClose } = useDisclosure()
    const { isOpen: isTaskOpen, onOpen: onTaskOpen, onClose: onTaskClose } = useDisclosure()
    const [editingTask, setEditingTask] = useState(null)
    const [taskForm, setTaskForm] = useState({ time: '12:00', activity: '', xp: 50, is_custom: true })
    const [isThinking, setIsThinking] = useState(false)
    const [messages, setMessages] = useState([])
    const [inputText, setInputText] = useState("")
    const chatEndRef = useRef(null)

    const [tabIndex, setTabIndex] = useState(() => {
        try { return parseInt(localStorage.getItem('activeTab') || '0', 10) } catch { return 0 }
    })

    const handleTabChange = (index) => {
        setTabIndex(index)
        localStorage.setItem('activeTab', index.toString())
    }

    // Responsive values
    const sidebarWidth = useBreakpointValue({ base: "0px", lg: "280px" })
    const isMobile = useBreakpointValue({ base: true, lg: false })

    // Colors
    const bgColor = useColorModeValue('gray.50', 'gray.900')
    const cardBg = useColorModeValue('white', 'gray.800')

    // Initial Sync & Hydration
    useEffect(() => {
        const hydrate = async () => {
            try {
                // 1. Get User State
                const userRes = await fetch(`${API_BASE}/user/${USERNAME}`)
                const userData = await userRes.json()
                setLevel(userData.level)
                setXp(userData.xp)

                // 2. Get Chat History
                const chatRes = await fetch(`${API_BASE}/history/${USERNAME}`)
                const chatData = await chatRes.json()
                setMessages(chatData.map(m => ({ text: m.text, sender: m.sender })))

                // 3. Get TODAY'S completed tasks (date-scoped, auto-resets daily)
                const dailyRes = await fetch(`${API_BASE}/daily/${USERNAME}`)
                const dailyData = await dailyRes.json()
                setCompletedQuests(dailyData.map(d => d.task_time))

                // 4. Initial AI Day Plan (Seeding / Healing)
                const planRes = await fetch(`${API_BASE}/daily/${USERNAME}/plan`)
                let planData = await planRes.json()

                // Ensure chronological sort for Focus selection
                planData.sort((a, b) => a.time.localeCompare(b.time))

                // Split tasks into Core (from life.md Constitution) and Custom (AI/Manual added)
                const coreFromDB = planData.filter(t => !t.is_custom)
                const customFromDB = planData.filter(t => t.is_custom)

                setSchedule({ fixed: coreFromDB, flexible: [] })
                setCustomTasks(customFromDB)

                // 5. Get Process Stats
                const statsRes = await fetch(`${API_BASE}/stats/process/${USERNAME}`)
                const statsData = await statsRes.json()
                setProcessStats(statsData)

                // 6. Get Overall Progress History
                const progressRes = await fetch(`${API_BASE}/progress/${USERNAME}`)
                const progressData = await progressRes.json()
                setProgress(progressData)

                // Find next incomplete quest (Uses sorted planData)
                const nextQuest = planData.find(q => !dailyData.map(d => d.task_time).includes(q.time))
                setActiveQuest(nextQuest || planData[0])
            } catch (err) {
                console.error("Hydration Error:", err)
            }
        }
        hydrate()
    }, [])

    useEffect(() => {
        if (isOracleOpen) {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }
    }, [messages, isOracleOpen])

    const toggleTask = async (task) => {
        try {
            const res = await fetch(`${API_BASE}/daily/${USERNAME}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    time: task.time,
                    activity: task.activity,
                    xp: task.xp || 50,
                    is_custom: task.is_custom || false
                })
            })
            const data = await res.json()

            if (data.status === 'updated') {
                if (data.completed) {
                    setCompletedQuests(prev => [...prev, task.time])
                } else {
                    setCompletedQuests(prev => prev.filter(t => t !== task.time))
                }
                setXp(data.xp)
                setLevel(data.level)
                // Refresh progress after toggling
                const progressRes = await fetch(`${API_BASE}/progress/${USERNAME}`)
                setProgress(await progressRes.json())
            }
        } catch (err) {
            console.error("Toggle Error:", err)
        }
    }

    const handleSendMessage = async (e) => {
        e.preventDefault()
        if (!inputText.trim()) return

        const userMsg = inputText
        setMessages(prev => [...prev, { text: userMsg, sender: 'user' }])
        setInputText("")
        setIsThinking(true)

        try {
            const res = await fetch(`${API_BASE}/chat/${USERNAME}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_input: userMsg })
            })
            const response = await res.json()

            setIsThinking(false)
            setMessages(prev => [...prev, { text: response.message, sender: 'oracle' }])

            // AGENTIC ACTION HANDLING
            if (['schedule_task', 'edit_task', 'delete_task'].includes(response.action)) {
                // Refresh tasks to show the new custom task
                const tasksRes = await fetch(`${API_BASE}/tasks/${USERNAME}`)
                const tasksData = await tasksRes.json()
                setCustomTasks(tasksData.filter(t => t.is_custom))

                // If the user is on Focus tab, maybe update active quest
                if (tabIndex === 0) {
                    setActiveQuest(tasksData.find(t => !t.completed) || activeQuest)
                }
            } else if (response.action === 'add_xp') {
                const userRes = await fetch(`${API_BASE}/user/${USERNAME}`)
                const userData = await userRes.json()
                setXp(userData.xp)
                setLevel(userData.level)
            }
        } catch (err) {
            console.error("Chat Error:", err)
            setIsThinking(false)
        }
    }

    const handleSaveTask = async (e) => {
        e.preventDefault()

        // For life.md tasks, suppress the old one and create new custom entry
        // For custom DB tasks, do a PUT update
        const isLifeMdTask = editingTask && !editingTask.is_custom

        try {
            if (!editingTask) {
                // New task: POST
                await fetch(`${API_BASE}/tasks/${USERNAME}/manual`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...taskForm, is_custom: true })
                })
            } else if (isLifeMdTask) {
                // To heal/edit a life.md task: we delete the original from DB (so AI can refill if needed) 
                // and add the edited version as a new custom entry.
                await fetch(`${API_BASE}/tasks/${USERNAME}/manual/${editingTask.time}`, { method: 'DELETE' })
                await fetch(`${API_BASE}/tasks/${USERNAME}/manual`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...taskForm, is_custom: true })
                })
            } else {
                // Custom DB task: PUT
                await fetch(`${API_BASE}/tasks/${USERNAME}/manual/${editingTask.time}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(taskForm)
                })
            }

            // Refresh via Plan endpoint (Heals/Syncs with Oracle)
            const planRes = await fetch(`${API_BASE}/daily/${USERNAME}/plan`)
            const planData = await planRes.json()
            setCustomTasks(planData.filter(t => t.is_custom))
            setSchedule({ fixed: planData.filter(t => !t.is_custom), flexible: [] })
            onTaskClose()
        } catch (err) { console.error('Save Task Error:', err) }
    }

    const handleDeleteTask = async (task, e) => {
        e.stopPropagation()
        try {
            await fetch(`${API_BASE}/tasks/${USERNAME}/manual/${task.time}`, { method: 'DELETE' })
            const planRes = await fetch(`${API_BASE}/daily/${USERNAME}/plan`)
            const planData = await planRes.json()
            setCustomTasks(planData.filter(t => t.is_custom))
            setSchedule({ fixed: planData.filter(t => !t.is_custom), flexible: [] })
        } catch (err) { console.error("Delete Task Error:", err) }
    }

    const openEditModal = (task, e) => {
        e.stopPropagation()
        setEditingTask(task)
        setTaskForm({ time: task.time, activity: task.activity, xp: task.xp || 50, is_custom: task.is_custom || false })
        onTaskOpen()
    }

    const openAddModal = () => {
        setEditingTask(null)
        setTaskForm({ time: '12:00', activity: '', xp: 50, is_custom: true })
        onTaskOpen()
    }

    const maxXp = getXpForNextLevel(level)
    const progressPercent = (xp / maxXp) * 100

    // Format 24hr time to 12hr AM/PM: "05:00" -> "5:00 AM"
    const formatTime = (t) => {
        if (!t) return ''
        const [h, m] = t.split(':').map(Number)
        const ampm = h >= 12 ? 'PM' : 'AM'
        const h12 = h % 12 || 12
        return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
    }

    // Assign period to any task that doesn't have one (e.g., Oracle-added custom tasks)
    const withPeriod = (task) => {
        if (task.period) return task
        const h = parseInt((task.time || '00:00').split(':')[0], 10)
        let period = 'Morning'
        if (h >= 12 && h < 17) period = 'Afternoon'
        if (h >= 17 || h < 4) period = 'Evening'
        return { ...task, period }
    }

    // Merge MD schedule with custom DB tasks
    const allFixedTasks = React.useMemo(() => {
        return [...schedule.fixed, ...customTasks]
            .map(withPeriod)
            .sort((a, b) => a.time.localeCompare(b.time))
    }, [schedule.fixed, customTasks])

    // Time-based Focus Sync (Updates Active Mission automatically based on clock)
    useEffect(() => {
        if (allFixedTasks.length === 0) return

        const syncFocusTime = () => {
            const now = new Date()
            const hStr = now.getHours().toString().padStart(2, '0')
            const mStr = now.getMinutes().toString().padStart(2, '0')
            const currentStr = `${hStr}:${mStr}`

            let currentTask = allFixedTasks[0]
            for (const t of allFixedTasks) {
                if (t.time <= currentStr) currentTask = t
                else break
            }

            setActiveQuest(prev => prev?.time !== currentTask.time ? currentTask : prev)
        }

        syncFocusTime()
        const interval = setInterval(syncFocusTime, 60000) // Re-sync every minute
        return () => clearInterval(interval)
    }, [allFixedTasks])

    // Chart Data Preparation
    const auditData = [
        { name: 'Completed', value: completedQuests.length, color: '#48BB78' },
        { name: 'Pending', value: Math.max(0, allFixedTasks.length - completedQuests.length), color: '#EDF2F7' }
    ]

    const totalTasks = allFixedTasks.length || 1
    const completionRate = Math.min(100, Math.round((completedQuests.length / totalTasks) * 100))
    const streakScore = Math.min(100, progress.streak * 10)
    const daysScore = Math.min(100, progress.total_days_active * 2)
    const levelScore = Math.min(100, (level - 1) * 10)

    const statsRadarData = [
        { subject: 'Strength', A: Math.min(100, levelScore + streakScore / 2), fullMark: 100 },
        { subject: 'Discipline', A: completionRate, fullMark: 100 },
        { subject: 'Intelligence', A: Math.min(100, levelScore), fullMark: 100 },
        { subject: 'Integrity', A: daysScore, fullMark: 100 },
        { subject: 'Resilience', A: streakScore, fullMark: 100 },
    ]

    const xpHistoryData = [
        { name: 'Base', xp: 0 },
        { name: 'Current', xp: xp }
    ]

    const SidebarContent = () => (
        <VStack h="full" p={8} spacing={8} align="stretch" bg={cardBg} shadow="xl" borderRight="1px" borderColor="gray.100">
            <HStack spacing={4}>
                <Avatar size="md" src="https://bit.ly/tioluwani-kolawole" border="2px solid" borderColor="blue.500" />
                <VStack align="start" spacing={0}>
                    <Badge colorScheme="blue" borderRadius="full">Rank {level}</Badge>
                    <Heading size="sm" fontWeight="900">Life Agent</Heading>
                </VStack>
            </HStack>

            <Box p={3} bg="blue.50" borderRadius="xl">
                <Text fontSize="10px" fontWeight="900" color="blue.600" textTransform="uppercase" mb={1}>Process Age</Text>
                <HStack justify="space-between">
                    <VStack align="start" spacing={0}><Text fontSize="xl" fontWeight="900" lineHeight="1">{processStats.days}</Text><Text fontSize="xs" fontWeight="700" color="blue.400">DAYS</Text></VStack>
                    <VStack align="start" spacing={0}><Text fontSize="xl" fontWeight="900" lineHeight="1">{processStats.weeks}</Text><Text fontSize="xs" fontWeight="700" color="blue.400">WEEKS</Text></VStack>
                </HStack>
            </Box>

            <VStack spacing={2} align="stretch">
                <Button leftIcon={<FiLayout />} justifyContent="start" variant={tabIndex === 0 ? "solid" : "ghost"} colorScheme="blue" onClick={() => handleTabChange(0)}>Focus</Button>
                <Button leftIcon={<FiCheckCircle />} justifyContent="start" variant={tabIndex === 1 ? "solid" : "ghost"} colorScheme="blue" onClick={() => handleTabChange(1)}>Log</Button>
                <Button leftIcon={<FiAward />} justifyContent="start" variant={tabIndex === 2 ? "solid" : "ghost"} colorScheme="blue" onClick={() => handleTabChange(2)}>Stats</Button>
                <Button leftIcon={<FiUser />} justifyContent="start" variant="ghost">Profile</Button>
            </VStack>

            <Divider />

            <Box flex={1}>
                <Text fontSize="10px" fontWeight="900" color="gray.400" mb={4} textTransform="uppercase">Experience Vector</Text>
                <Progress value={progressPercent} size="xs" colorScheme="blue" borderRadius="full" mb={2} />
                <Text fontSize="10px" fontWeight="800" color="gray.500">{xp} / {maxXp} XP</Text>
            </Box>

            <Button leftIcon={<FiMessageSquare />} colorScheme="blue" shadow="lg" onClick={onOracleOpen}>Oracle HUD</Button>
        </VStack>
    )

    return (
        <Box minH="100vh" bg={bgColor} display="flex">
            {/* Desktop Sidebar */}
            <Box w={sidebarWidth} display={{ base: "none", lg: "block" }} position="fixed" h="100vh" zIndex={200}>
                <SidebarContent />
            </Box>

            {/* Main Content Area */}
            <Box flex={1} ml={sidebarWidth} pb={{ base: 32, lg: 8 }} transition="margin 0.2s">
                {/* Mobile Header (Hidden on Laptop) */}
                <Box display={{ base: "block", lg: "none" }} bg={cardBg} pt={10} pb={6} px={6} shadow="sm" borderBottomRadius="3xl">
                    <Container maxW="container.md" p={0}>
                        <HStack justify="space-between" align="center" mb={6}>
                            <HStack spacing={4}>
                                <Avatar size="lg" src="https://bit.ly/tioluwani-kolawole" border="2px solid" borderColor="blue.500" />
                                <VStack align="start" spacing={0}>
                                    <Badge colorScheme="blue" borderRadius="full">Rank {level}</Badge>
                                    <Heading size="lg" fontWeight="900" letterSpacing="-1px">Life Agent</Heading>
                                </VStack>
                            </HStack>
                            <Box bg="blue.50" p={3} borderRadius="xl" textAlign="center">
                                <Text fontSize="xl" fontWeight="900" lineHeight="1" color="blue.600">{processStats.days}</Text>
                                <Text fontSize="10px" fontWeight="900" color="blue.400">DAYS IN PROCESS</Text>
                            </Box>
                        </HStack>
                        <Progress value={progressPercent} size="sm" colorScheme="blue" borderRadius="full" />
                    </Container>
                </Box>

                {/* Main Content Containers */}
                <Container maxW={{ base: "full", md: "container.md", lg: "container.lg" }} mt={{ base: 6, lg: 12 }} p={4}>
                    <Tabs index={tabIndex} onChange={handleTabChange} variant="soft-rounded" colorScheme="blue">
                        <TabList
                            display={{ base: "flex", lg: "none" }}
                            bg={cardBg} p={2} borderRadius="2xl" shadow="sm" mb={6} justifyContent="center" gap={2}
                        >
                            <Tab py={2} flex={1}><HStack spacing={2}><Icon as={FiLayout} /><Text fontWeight="700">FOCUS</Text></HStack></Tab>
                            <Tab py={2} flex={1}><HStack spacing={2}><Icon as={FiCheckCircle} /><Text fontWeight="700">LOG</Text></HStack></Tab>
                            <Tab py={2} flex={1}><HStack spacing={2}><Icon as={FiAward} /><Text fontWeight="700">STATS</Text></HStack></Tab>
                        </TabList>

                        <TabPanels>
                            {/* FOCUS TAB */}
                            <TabPanel p={0}>
                                <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={8}>
                                    <VStack spacing={6} align="stretch">
                                        <Box bg={cardBg} p={{ base: 8, lg: 12 }} borderRadius="3xl" shadow="xl" border="1px solid" borderColor="gray.100" position="relative" overflow="hidden">
                                            <VStack align="start" spacing={1} mb={8}>
                                                <Badge colorScheme={activeQuest?.is_custom ? "purple" : "orange"} px={3} borderRadius="md" mb={2}>{activeQuest?.is_custom ? "CUSTOM MISSION" : "ACTIVE MISSION"}</Badge>
                                                <Heading size="2xl" fontWeight="900" letterSpacing="-1.5px">{activeQuest?.activity || 'Calculating...'}</Heading>
                                                <Text color="gray.500" fontWeight="700">Scheduled for {formatTime(activeQuest?.time)}</Text>
                                            </VStack>
                                            <SimpleGrid columns={2} spacing={4} mb={10}>
                                                <Box bg="gray.50" p={5} borderRadius="2xl">
                                                    <Text fontSize="10px" fontWeight="900" color="gray.400" textTransform="uppercase" mb={1}>Reward</Text>
                                                    <HStack color="orange.500" fontWeight="900"><Icon as={FiZap} /><Text fontSize="xl">+{activeQuest?.xp || 0} XP</Text></HStack>
                                                </Box>
                                                <Box bg="gray.50" p={5} borderRadius="2xl">
                                                    <Text fontSize="10px" fontWeight="900" color="gray.400" textTransform="uppercase" mb={1}>Time</Text>
                                                    <HStack color="blue.500" fontWeight="900"><Icon as={FiClock} /><Text fontSize="xl">{formatTime(activeQuest?.time)}</Text></HStack>
                                                </Box>
                                            </SimpleGrid>
                                            <Button w="full" size="lg" h="72px" colorScheme={completedQuests.includes(activeQuest?.time) ? "green" : "blue"} borderRadius="2xl" fontSize="xl" fontWeight="900" onClick={() => activeQuest && toggleTask(activeQuest)}>
                                                {completedQuests.includes(activeQuest?.time) ? "MISSION SECURED" : "EXECUTE TASK"}
                                            </Button>
                                        </Box>
                                    </VStack>

                                    <SimpleGrid columns={{ base: 1, md: 2, lg: 1 }} spacing={6}>
                                        <Box bg={cardBg} p={6} borderRadius="3xl" shadow="md" border="1px solid" borderColor="gray.50">
                                            <Heading size="sm" mb={4}>Mission Audit</Heading>
                                            <Box h="200px"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={auditData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">{auditData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></Box>
                                        </Box>
                                        <Box bg={cardBg} p={6} borderRadius="3xl" shadow="md" border="1px solid" borderColor="gray.50">
                                            <Heading size="sm" mb={4}>XP Pulse</Heading>
                                            <Box h="150px"><ResponsiveContainer width="100%" height="100%"><AreaChart data={xpHistoryData}><defs><linearGradient id="gXp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs><Area type="monotone" dataKey="xp" stroke="#6366f1" fill="url(#gXp)" /><Tooltip /></AreaChart></ResponsiveContainer></Box>
                                        </Box>
                                    </SimpleGrid>
                                </SimpleGrid>
                            </TabPanel>

                            {/* LOG TAB */}
                            <TabPanel p={0}>
                                <HStack justify="space-between" mb={6}>
                                    <Heading size="md" color="gray.700">Operations Log</Heading>
                                    <Button leftIcon={<FiPlus />} colorScheme="blue" size="sm" borderRadius="full" shadow="sm" onClick={openAddModal}>Add Mission</Button>
                                </HStack>

                                {['Morning', 'Afternoon', 'Evening'].map(period => {
                                    const periodTasks = allFixedTasks.filter(t => (t.period || 'Morning') === period)
                                    if (periodTasks.length === 0) return null

                                    return (
                                        <Box key={period} mb={8}>
                                            <Heading size="sm" color="gray.500" mb={4} textTransform="uppercase" letterSpacing="1px">{period} Protocol</Heading>
                                            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                                                {periodTasks.map((task, i) => (
                                                    <MotionBox key={`${period}-${i}`} bg={cardBg} p={5} borderRadius="2xl" shadow="sm" border="1px solid" borderColor={completedQuests.includes(task.time) ? "green.100" : task.is_custom ? "purple.100" : "gray.50"} cursor="pointer" onClick={() => toggleTask(task)} whileHover={{ x: 5 }} opacity={completedQuests.includes(task.time) ? 0.6 : 1}>
                                                        <HStack spacing={4}>
                                                            <Circle size="10" bg={completedQuests.includes(task.time) ? "green.500" : task.is_custom ? "purple.500" : "gray.100"} color={completedQuests.includes(task.time) || task.is_custom ? "white" : "gray.400"}><Icon as={FiCheckCircle} /></Circle>
                                                            <VStack align="start" spacing={0} flex={1}><Text fontWeight="800" fontSize="lg">{task.activity}</Text><Text fontSize="xs" fontWeight="900" color="gray.400">{formatTime(task.time)}</Text></VStack>
                                                            <HStack flexShrink={0}>
                                                                <Badge colorScheme={task.is_custom ? "purple" : "blue"}>+{task.xp}XP</Badge>
                                                                <IconButton icon={<FiEdit2 />} size="xs" variant="ghost" onClick={(e) => openEditModal(task, e)} aria-label="Edit" />
                                                                <IconButton icon={<FiTrash2 />} size="xs" variant="ghost" colorScheme="red" onClick={(e) => handleDeleteTask(task, e)} aria-label="Delete" />
                                                            </HStack>
                                                        </HStack>
                                                    </MotionBox>
                                                ))}
                                            </SimpleGrid>
                                        </Box>
                                    )
                                })}
                            </TabPanel>

                            {/* STATS TAB */}
                            <TabPanel p={0}>
                                {/* Overall Progress */}
                                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={8}>
                                    <Box bg={cardBg} p={6} borderRadius="2xl" shadow="sm" textAlign="center" border="1px solid" borderColor="orange.100">
                                        <Text fontSize="3xl" fontWeight="900" color="orange.500">🔥 {progress.streak}</Text>
                                        <Text fontSize="xs" fontWeight="800" color="gray.500" textTransform="uppercase">Day Streak</Text>
                                    </Box>
                                    <Box bg={cardBg} p={6} borderRadius="2xl" shadow="sm" textAlign="center" border="1px solid" borderColor="blue.100">
                                        <Text fontSize="3xl" fontWeight="900" color="blue.500">{progress.total_days_active}</Text>
                                        <Text fontSize="xs" fontWeight="800" color="gray.500" textTransform="uppercase">Days Active</Text>
                                    </Box>
                                    <Box bg={cardBg} p={6} borderRadius="2xl" shadow="sm" textAlign="center" border="1px solid" borderColor="green.100">
                                        <Text fontSize="3xl" fontWeight="900" color="green.500">{progress.total_tasks_completed}</Text>
                                        <Text fontSize="xs" fontWeight="800" color="gray.500" textTransform="uppercase">Total Completions</Text>
                                    </Box>
                                </SimpleGrid>

                                {/* Daily History Chart */}
                                {progress.history.length > 0 && (
                                    <Box bg={cardBg} p={6} borderRadius="3xl" shadow="md" border="1px solid" borderColor="gray.50" mb={8}>
                                        <Heading size="sm" mb={4}>Daily Completion History (last 30 days)</Heading>
                                        <Box h="180px">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={progress.history}>
                                                    <defs>
                                                        <linearGradient id="gDaily" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#48BB78" stopOpacity={0.4} />
                                                            <stop offset="95%" stopColor="#48BB78" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" />
                                                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#A0AEC0' }} tickFormatter={d => d.slice(5)} />
                                                    <YAxis tick={{ fontSize: 9, fill: '#A0AEC0' }} />
                                                    <Tooltip formatter={(v) => [`${v} tasks`, 'Completed']} />
                                                    <Area type="monotone" dataKey="completed" stroke="#48BB78" fill="url(#gDaily)" strokeWidth={2} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </Box>
                                    </Box>
                                )}

                                <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={8}>
                                    <Box bg={cardBg} p={8} borderRadius="3xl" shadow="lg" border="1px solid" borderColor="gray.50">
                                        <Heading size="md" mb={8}>Character Vitals</Heading>
                                        <Box h="300px" w="full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={statsRadarData}>
                                                    <PolarGrid stroke="#EDF2F7" />
                                                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 700, fill: '#A0AEC0' }} />
                                                    <Radar name="Agent" dataKey="A" stroke="#4C51BF" fill="#4C51BF" fillOpacity={0.6} />
                                                </RadarChart>
                                            </ResponsiveContainer>
                                        </Box>
                                    </Box>
                                    <VStack spacing={6} align="stretch" bg={cardBg} p={8} borderRadius="3xl" shadow="xl">
                                        <Heading size="md" mb={4}>Efficiency Vectors</Heading>
                                        {statsRadarData.map((s, i) => (
                                            <Box key={i} flex={1}>
                                                <HStack justify="space-between" mb={2}><Text fontSize="xs" fontWeight="900" color="gray.500" textTransform="uppercase">{s.subject}</Text><Text fontSize="xs" fontWeight="900" color="blue.500">{s.A}%</Text></HStack>
                                                <Progress value={s.A} colorScheme="blue" size="xs" borderRadius="full" />
                                            </Box>
                                        ))}
                                    </VStack>
                                </SimpleGrid>
                            </TabPanel>
                        </TabPanels>
                    </Tabs>
                </Container>
            </Box>

            {/* Oracle HUD Button (Mobile) */}
            <IconButton icon={<FiMessageSquare />} colorScheme="blue" size="lg" isRound position="fixed" bottom="110px" right="6" shadow="2xl" fontSize="24px" onClick={onOracleOpen} zIndex={140} display={{ base: "flex", lg: "none" }} aria-label="Oracle HUD" />

            {/* Nav Footer (Mobile) */}
            <Box display={{ base: "block", lg: "none" }} position="fixed" bottom="0" left="0" right="0" bg="white" p={4} px={8} shadow="2xl" borderTopRadius="3xl" zIndex={100}>
                <HStack justify="space-around">
                    <IconButton icon={<FiLayout />} variant={tabIndex === 0 ? "solid" : "ghost"} colorScheme="blue" onClick={() => handleTabChange(0)} aria-label="Home" />
                    <Circle size="12" bg="blue.500" color="white" shadow="lg" transform="translateY(-20px)" cursor="pointer" onClick={() => handleTabChange(0)}><Icon as={FiZap} fontSize="20px" /></Circle>
                    <IconButton icon={<FiAward />} variant={tabIndex === 2 ? "solid" : "ghost"} colorScheme="blue" onClick={() => handleTabChange(2)} aria-label="Stats" />
                </HStack>
            </Box>

            {/* Oracle Chat Drawer */}
            <Drawer isOpen={isOracleOpen} placement={isMobile ? "bottom" : "right"} onClose={onOracleClose} size={isMobile ? "full" : "md"}>
                <DrawerOverlay backdropFilter="blur(5px)" bg="blackAlpha.300" />
                <DrawerContent borderTopRadius={isMobile ? "3xl" : "none"} maxW={isMobile ? "480px" : "400px"} mx={isMobile ? "auto" : "0"}>
                    <DrawerCloseButton />
                    <DrawerHeader borderBottomWidth="1px" py={6} bg={cardBg}>
                        <HStack><Circle size="3" bg="green.400" className="pulse-animation" /><Heading size="md" fontWeight="900">Oracle HUD</Heading></HStack>
                    </DrawerHeader>
                    <DrawerBody p={0} display="flex" flexDirection="column" h="100vh" bg={cardBg}>
                        <Box flex={1} overflowY="auto" p={6} display="flex" flexDirection="column" gap={4}>
                            {messages.map((m, i) => (
                                <Box key={i} display="flex" justifyContent={m.sender === 'user' ? 'flex-end' : 'flex-start'}>
                                    <Box maxW="85%" p={4} borderRadius="2xl" bg={m.sender === 'user' ? 'blue.600' : 'gray.100'} color={m.sender === 'user' ? 'white' : 'gray.800'} fontSize="sm" fontWeight="600" boxShadow="sm" borderBottomRadius={m.sender === 'user' ? 'none' : '2xl'} borderTopRadius="2xl">{m.text}</Box>
                                </Box>
                            ))}
                            {isThinking && <HStack spacing={2} p={4} bg="gray.50" borderRadius="2xl" w="fit-content" alignSelf="flex-start"><Circle size="2" bg="blue.500" opacity={0.4} /><Circle size="2" bg="blue.500" opacity={0.6} /><Circle size="2" bg="blue.500" opacity={0.8} /></HStack>}
                            <div ref={chatEndRef} />
                        </Box>
                        <Box p={6} pb={8} bg={cardBg} borderTopWidth="1px">
                            <form onSubmit={handleSendMessage}><InputGroup size="lg"><Input pr="4.5rem" placeholder="Enter uplink..." bg="gray.50" border="none" borderRadius="xl" fontWeight="600" value={inputText} onChange={(e) => setInputText(e.target.value)} /><InputRightElement width="4.5rem" h="full"><IconButton size="md" colorScheme="blue" icon={<FiSend />} type="submit" borderRadius="lg" /></InputRightElement></InputGroup></form>
                        </Box>
                    </DrawerBody>
                </DrawerContent>
            </Drawer>

            {/* Task Manual Editor Modal */}
            <Modal isOpen={isTaskOpen} onClose={onTaskClose} isCentered>
                <ModalOverlay backdropFilter="blur(5px)" />
                <ModalContent borderRadius="3xl" mx={4}>
                    <form onSubmit={handleSaveTask}>
                        <ModalHeader fontWeight="900">{editingTask ? "Edit Mission" : "New Mission"}</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                            <VStack spacing={4}>
                                <FormControl isRequired>
                                    <FormLabel fontWeight="800" fontSize="xs" textTransform="uppercase" color="gray.500">Time (HH:MM)</FormLabel>
                                    <Input type="time" variant="filled" borderRadius="xl" value={taskForm.time} onChange={(e) => setTaskForm({ ...taskForm, time: e.target.value })} />
                                </FormControl>
                                <FormControl isRequired>
                                    <FormLabel fontWeight="800" fontSize="xs" textTransform="uppercase" color="gray.500">Activity</FormLabel>
                                    <Input placeholder="E.g. Deep Work Session" variant="filled" borderRadius="xl" value={taskForm.activity} onChange={(e) => setTaskForm({ ...taskForm, activity: e.target.value })} />
                                </FormControl>
                                <FormControl isRequired>
                                    <FormLabel fontWeight="800" fontSize="xs" textTransform="uppercase" color="gray.500">XP Reward</FormLabel>
                                    <NumberInput value={taskForm.xp} min={0} max={1000} onChange={(_, val) => setTaskForm({ ...taskForm, xp: val })}>
                                        <NumberInputField variant="filled" borderRadius="xl" />
                                        <NumberInputStepper>
                                            <NumberIncrementStepper />
                                            <NumberDecrementStepper />
                                        </NumberInputStepper>
                                    </NumberInput>
                                </FormControl>
                            </VStack>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="ghost" mr={3} onClick={onTaskClose}>Cancel</Button>
                            <Button type="submit" colorScheme="blue" borderRadius="full" shadow="sm">Save Mission</Button>
                        </ModalFooter>
                    </form>
                </ModalContent>
            </Modal>
        </Box>
    )
}
