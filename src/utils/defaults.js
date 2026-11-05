import { toMin, toHHMM, todayStr, addDays, uid } from './dates';

export const SUBJECT_COLORS = [
  { label: 'Royal Blue', hex: '#2563eb' },
  { label: 'Teal', hex: '#0f766e' },
  { label: 'Purple', hex: '#7c3aed' },
  { label: 'Coral Orange', hex: '#ea580c' },
  { label: 'Crimson', hex: '#dc2626' },
  { label: 'Indigo', hex: '#4f46e5' },
  { label: 'Emerald', hex: '#059669' },
  { label: 'Amber Gold', hex: '#d97706' },
  { label: 'Cyan', hex: '#0891b2' },
  { label: 'Rose Pink', hex: '#db2777' },
  { label: 'Slate', hex: '#475569' },
  { label: 'Lime Green', hex: '#65a30d' },
];

export function getSubjectColor(subject, index = 0) {
  if (subject && subject.color) return subject.color;
  return SUBJECT_COLORS[Math.abs(index) % SUBJECT_COLORS.length].hex;
}

export const DEFAULT_SETTINGS = {
  dailyGoal: 4,
  maxDailyHours: 8,
  theme: 'light',
  timeFormat: '12h',
  sessionMinutes: 50,
  shortBreak: 10,
  longBreak: 30,
  longAfter: 3,
  mealBreaks: true,
  lunchStart: '13:00',
  lunchDuration: 45,
  dinnerStart: '20:00',
  dinnerDuration: 30,
  sleepStart: '23:00',
  sleepEnd: '06:30',
  collegeStart: '09:00',
  collegeEnd: '16:00',
  collegeDays: [1, 2, 3, 4, 5],
  examShare: 40,
  browserNotifications: false,
};

// Suggest free study windows from college hours and sleep hours.
export function suggestWindows(s) {
  const wake = toMin(s.sleepEnd || '06:30');
  const sleep = Math.min(toMin(s.sleepStart || '23:00'), 1439);
  const cs = toMin(s.collegeStart || '09:00');
  const ce = toMin(s.collegeEnd || '16:00');
  const college = [];
  if (cs - 60 - wake >= 30) college.push({ start: toHHMM(wake), end: toHHMM(cs - 60) });
  if (sleep - 60 - (ce + 60) >= 30) college.push({ start: toHHMM(ce + 60), end: toHHMM(sleep - 60) });
  const holiday = [];
  if (sleep - 60 - (wake + 60) >= 30) holiday.push({ start: toHHMM(wake + 60), end: toHHMM(sleep - 60) });
  return { college, holiday };
}

export function defaultAvailability(settings = DEFAULT_SETTINGS) {
  const a = {};
  for (let d = 0; d < 7; d++) a[d] = suggestWindows(settings);
  return a;
}

export function defaultData() {
  return {
    profile: { name: '', college: '', course: '' },
    settings: { ...DEFAULT_SETTINGS },
    availability: defaultAvailability(),
    commitments: [], // {id,title,day:'all'|'0'..'6',start,end}
    holidays: [], // {id,title,type:'holiday'|'unavailable',from,to}
    subjects: [], // {id,name,code,color,description,notes,difficulty,category:'college'|'exam'|'optional',examId,topics:[{id,name,done}]}
    exams: [], // {id,name,category,type,date,time,targetHours,notes}
    tasks: [], // {id,title,kind,subjectId,parentId,priority,deadline,estimate,done,status,assignedDate,assignmentType,team,notes}
    sessions: [], // {id,date,start,end,kind:'study'|'break',breakKind,subjectId,taskId,title,topic,label,track,done,locked}
    logs: [], // {id,date,subjectId,minutes,topics,notes,sessionId?}
  };
}

export function getSampleData() {
  const today = todayStr();
  const subDsaId = 'sub-dsa-' + uid().slice(0, 5);
  const subDbmsId = 'sub-dbms-' + uid().slice(0, 5);
  const subOsId = 'sub-os-' + uid().slice(0, 5);
  const subCnId = 'sub-cn-' + uid().slice(0, 5);
  const subGateMathId = 'sub-gatemath-' + uid().slice(0, 5);
  const subGateTocId = 'sub-gatetoc-' + uid().slice(0, 5);

  const examGateId = 'ex-gate-' + uid().slice(0, 5);
  const examSemId = 'ex-sem-' + uid().slice(0, 5);
  const examDbmsMidId = 'ex-dbms-' + uid().slice(0, 5);
  const examOsLabId = 'ex-oslab-' + uid().slice(0, 5);

  const projCloudId = 'proj-cloud-' + uid().slice(0, 5);

  const subjects = [
    {
      id: subDsaId,
      name: 'Data Structures & Algorithms',
      code: 'CS201',
      color: '#2563eb', // Royal Blue
      difficulty: 'Hard',
      category: 'college',
      examId: examSemId,
      description: 'Advanced data structures, balanced trees, graph algorithms and dynamic programming.',
      notes: 'Focus on graph traversals, Dijkstra, and DP memoization patterns.',
      topics: [
        { id: uid(), name: 'Arrays & Two-Pointer Problems', done: true },
        { id: uid(), name: 'Singly & Doubly Linked Lists', done: true },
        { id: uid(), name: 'Binary Search Trees & AVL Trees', done: true },
        { id: uid(), name: 'Graph Traversals (BFS & DFS)', done: false },
        { id: uid(), name: 'Shortest Path Algorithms (Dijkstra)', done: false },
        { id: uid(), name: 'Dynamic Programming Patterns', done: false },
      ],
    },
    {
      id: subDbmsId,
      name: 'Database Management Systems',
      code: 'CS301',
      color: '#0f766e', // Teal
      difficulty: 'Medium',
      category: 'college',
      examId: examDbmsMidId,
      description: 'Relational model, SQL queries, normalization, transactions and indexing.',
      notes: 'Prepare functional dependency proofs and BCNF decomposition examples.',
      topics: [
        { id: uid(), name: 'Entity-Relationship Diagrams', done: true },
        { id: uid(), name: 'Relational Algebra & SQL Joins', done: true },
        { id: uid(), name: 'Normalization (1NF, 2NF, 3NF, BCNF)', done: false },
        { id: uid(), name: 'Transactions & ACID Properties', done: false },
        { id: uid(), name: 'Concurrency Control & Locking', done: false },
      ],
    },
    {
      id: subOsId,
      name: 'Operating Systems',
      code: 'CS302',
      color: '#7c3aed', // Purple
      difficulty: 'Hard',
      category: 'college',
      examId: examOsLabId,
      description: 'Processes, CPU scheduling, synchronization, deadlock, virtual memory.',
      notes: 'Practice semaphore implementation and Banker algorithm problems.',
      topics: [
        { id: uid(), name: 'Process States & Context Switching', done: true },
        { id: uid(), name: 'CPU Scheduling (Round Robin, SRTF)', done: true },
        { id: uid(), name: 'Process Synchronization & Semaphores', done: false },
        { id: uid(), name: 'Deadlock Avoidance & Bankers Algorithm', done: false },
        { id: uid(), name: 'Virtual Memory & Page Replacement', done: false },
      ],
    },
    {
      id: subCnId,
      name: 'Computer Networks',
      code: 'CS303',
      color: '#ea580c', // Coral Orange
      difficulty: 'Medium',
      category: 'college',
      examId: examSemId,
      description: 'Layered architecture, routing, transport layer congestion control and sockets.',
      notes: 'Review subnet mask calculations and TCP 3-way handshake sequence.',
      topics: [
        { id: uid(), name: 'OSI Reference Model & Physical Layer', done: true },
        { id: uid(), name: 'Data Link Framing & CRC Error Check', done: true },
        { id: uid(), name: 'IP Addressing, CIDR & Subnetting', done: false },
        { id: uid(), name: 'Routing Protocols (RIP, OSPF, BGP)', done: false },
        { id: uid(), name: 'TCP Congestion Control & Window Flow', done: false },
      ],
    },
    {
      id: subGateMathId,
      name: 'GATE - Engineering Mathematics',
      code: 'GATE-MATH',
      color: '#dc2626', // Crimson
      difficulty: 'Hard',
      category: 'exam',
      examId: examGateId,
      description: 'Linear algebra, calculus, probability distributions and discrete mathematics for GATE CSE.',
      notes: 'Solve 10 years previous GATE math questions.',
      topics: [
        { id: uid(), name: 'Linear Algebra: Eigenvalues & Cayley-Hamilton', done: true },
        { id: uid(), name: 'Calculus: Maxima, Minima & Mean Value Theorem', done: true },
        { id: uid(), name: 'Discrete Math: Graph Coloring & Relations', done: false },
        { id: uid(), name: 'Probability: Bayes Theorem & Normal Distribution', done: false },
      ],
    },
    {
      id: subGateTocId,
      name: 'GATE - Theory of Computation',
      code: 'GATE-TOC',
      color: '#4f46e5', // Indigo
      difficulty: 'Hard',
      category: 'exam',
      examId: examGateId,
      description: 'Finite automata, regular expressions, context-free languages, Turing machines & undecidability.',
      notes: 'Focus on pumping lemma and reduction techniques for undecidability.',
      topics: [
        { id: uid(), name: 'DFA, NFA and State Minimization', done: true },
        { id: uid(), name: 'Regular Expressions & Pumping Lemma for Regular', done: false },
        { id: uid(), name: 'Context-Free Grammars & Pushdown Automata', done: false },
        { id: uid(), name: 'Turing Machines, Decidability & Halting Problem', done: false },
      ],
    },
  ];

  const exams = [
    {
      id: examSemId,
      name: 'Semester 5 University Exams',
      category: 'Computer Science',
      type: 'Semester',
      date: addDays(today, 24),
      time: '09:30',
      targetHours: 60,
      notes: 'Main university theory examinations for core computer science subjects.',
    },
    {
      id: examDbmsMidId,
      name: 'DBMS Mid-Semester Examination',
      category: 'College Internal',
      type: 'Internal',
      date: addDays(today, 5),
      time: '14:00',
      targetHours: 15,
      notes: 'Units 1, 2, and 3: ER modeling, SQL queries and Normalization up to BCNF.',
    },
    {
      id: examGateId,
      name: 'GATE CSE 2027',
      category: 'Competitive Examination',
      type: 'Competitive',
      date: addDays(today, 68),
      time: '09:00',
      targetHours: 120,
      notes: 'National competitive exam for IIT M.Tech admission and PSU placements.',
    },
    {
      id: examOsLabId,
      name: 'Operating Systems Lab & Viva',
      category: 'College Practical',
      type: 'Practical',
      date: addDays(today, 12),
      time: '10:00',
      targetHours: 10,
      notes: 'Linux shell scripting, POSIX thread synchronization and OS viva voce.',
    },
  ];

  const tasks = [
    {
      id: uid(),
      title: 'Practice 20 Graph BFS/DFS Problems on LeetCode',
      kind: 'study',
      subjectId: subDsaId,
      parentId: '',
      priority: 'High',
      deadline: addDays(today, 2),
      estimate: 3,
      status: 'In Progress',
      done: false,
      notes: 'Focus on topological sort and cycle detection in directed graphs.',
    },
    {
      id: uid(),
      title: 'GATE 2022-2024 TOC Previous Year Questions',
      kind: 'study',
      subjectId: subGateTocId,
      parentId: '',
      priority: 'High',
      deadline: addDays(today, 4),
      estimate: 2.5,
      status: 'In Progress',
      done: false,
      notes: 'Solve 30 PYQs under timed conditions.',
    },
    {
      id: uid(),
      title: 'DBMS Normalization & BCNF Case Study Report',
      kind: 'assignment',
      assignmentType: 'Written',
      subjectId: subDbmsId,
      parentId: '',
      priority: 'High',
      assignedDate: addDays(today, -5),
      deadline: addDays(today, 3),
      estimate: 3,
      status: 'In Progress',
      done: false,
      notes: 'Decompose airline reservation schema into 3NF and BCNF with lossless join proof.',
    },
    {
      id: uid(),
      title: 'Computer Networks Packet Tracer Subnetting Lab',
      kind: 'assignment',
      assignmentType: 'Laboratory',
      subjectId: subCnId,
      parentId: '',
      priority: 'Medium',
      assignedDate: addDays(today, -2),
      deadline: addDays(today, 7),
      estimate: 2,
      status: 'Not Started',
      done: false,
      notes: 'Simulate 4 subnets with router OSPF configuration in Cisco Packet Tracer.',
    },
    {
      id: uid(),
      title: 'Binary Search Tree Balancing Implementation',
      kind: 'assignment',
      assignmentType: 'Programming',
      subjectId: subDsaId,
      parentId: '',
      priority: 'Medium',
      assignedDate: addDays(today, -10),
      deadline: addDays(today, -1),
      estimate: 4,
      status: 'Submitted',
      done: true,
      notes: 'Implemented AVL self-balancing tree with left/right rotations in C++.',
    },
    {
      id: projCloudId,
      title: 'Distributed Cloud Storage with AES Encryption',
      kind: 'project',
      subjectId: subOsId,
      parentId: '',
      priority: 'High',
      deadline: addDays(today, 20),
      estimate: 24,
      status: 'In Progress',
      team: 'Alex Morgan, Priya Sharma, Rahul Verma',
      done: false,
      notes: 'Final year capstone project implementing chunk-level encryption and fault-tolerant storage.',
    },
    {
      id: uid(),
      title: 'System Architecture & Multi-Node Design Document',
      kind: 'milestone',
      subjectId: subOsId,
      parentId: projCloudId,
      priority: 'High',
      deadline: addDays(today, -3),
      estimate: 6,
      status: 'Completed',
      done: true,
      notes: 'Approved by project faculty guide.',
    },
    {
      id: uid(),
      title: 'File Chunking & AES-256 Encryption Module',
      kind: 'milestone',
      subjectId: subOsId,
      parentId: projCloudId,
      priority: 'High',
      deadline: addDays(today, 6),
      estimate: 8,
      status: 'In Progress',
      done: false,
      notes: 'Implementing client-side chunking and streaming cipher in Python/Go.',
    },
    {
      id: uid(),
      title: 'Replication Protocol & Web Dashboard Interface',
      kind: 'milestone',
      subjectId: subOsId,
      parentId: projCloudId,
      priority: 'Medium',
      deadline: addDays(today, 18),
      estimate: 10,
      status: 'Not Started',
      done: false,
      notes: 'Frontend monitoring console and distributed node health dashboard.',
    },
  ];

  const commitments = [
    {
      id: uid(),
      title: 'GATE Weekend Live Coaching',
      day: '6', // Saturday
      start: '09:00',
      end: '12:00',
    },
    {
      id: uid(),
      title: 'Campus Gym & Fitness',
      day: 'all',
      start: '17:00',
      end: '18:00',
    },
  ];

  const holidays = [
    {
      id: uid(),
      title: 'College Annual Tech Symposium (Holiday)',
      type: 'holiday',
      from: addDays(today, 9),
      to: addDays(today, 10),
    },
  ];

  // Past logs for the previous 6 days + today
  const logs = [
    { id: uid(), date: addDays(today, -6), subjectId: subDsaId, minutes: 100, topics: 'Arrays & Two-Pointer Problems', notes: 'Completed LeetCode medium array problems' },
    { id: uid(), date: addDays(today, -6), subjectId: subGateMathId, minutes: 120, topics: 'Eigenvalues & Diagonalization', notes: 'GATE PYQs 2018-2022' },
    { id: uid(), date: addDays(today, -5), subjectId: subDbmsId, minutes: 110, topics: 'ER Diagrams and Relational Algebra', notes: 'Solved textbook exercise questions' },
    { id: uid(), date: addDays(today, -5), subjectId: subOsId, minutes: 90, topics: 'Process States & CPU Scheduling', notes: 'Practiced Gantt charts for Round Robin' },
    { id: uid(), date: addDays(today, -4), subjectId: subDsaId, minutes: 150, topics: 'BST Construction & Traversal', notes: 'Implemented recursive and iterative BST traversals' },
    { id: uid(), date: addDays(today, -4), subjectId: subCnId, minutes: 80, topics: 'OSI Reference Model & Framing', notes: 'CRC bit calculation practice' },
    { id: uid(), date: addDays(today, -3), subjectId: subGateTocId, minutes: 140, topics: 'DFA State Minimization', notes: 'Myhill-Nerode theorem and DFA minimization table' },
    { id: uid(), date: addDays(today, -3), subjectId: subDbmsId, minutes: 60, topics: 'Complex SQL Joins', notes: 'Self joins and nested subqueries' },
    { id: uid(), date: addDays(today, -2), subjectId: subOsId, minutes: 120, topics: 'Synchronization & Semaphores', notes: 'Dining philosophers and producer-consumer' },
    { id: uid(), date: addDays(today, -2), subjectId: subDsaId, minutes: 90, topics: 'AVL Tree Rotations', notes: 'Assignment submission preparation' },
    { id: uid(), date: addDays(today, -1), subjectId: subGateMathId, minutes: 130, topics: 'Calculus & Mean Value Theorem', notes: 'Solved 15 previous GATE questions' },
    { id: uid(), date: addDays(today, -1), subjectId: subCnId, minutes: 70, topics: 'CIDR Subnet Masking', notes: 'Practiced VLSM subnetting calculations' },
    { id: uid(), date: today, subjectId: subDsaId, minutes: 90, topics: 'Graph Traversals (BFS & DFS)', notes: 'Completed from timetable' },
    { id: uid(), date: today, subjectId: subDbmsId, minutes: 60, topics: 'Normalization up to BCNF', notes: 'Mid-term exam preparation' },
  ];

  // Realistic timetable sessions for today and tomorrow
  const sessions = [
    {
      id: uid(),
      date: today,
      start: '06:30',
      end: '07:20',
      kind: 'study',
      subjectId: subDsaId,
      taskId: '',
      title: 'Data Structures & Algorithms',
      topic: 'Graph Traversals (BFS & DFS)',
      label: 'Topic Study',
      track: 'college',
      done: true,
      locked: false,
    },
    {
      id: uid(),
      date: today,
      start: '07:20',
      end: '07:30',
      kind: 'break',
      breakKind: 'short',
      title: 'Short break',
      done: false,
      locked: false,
    },
    {
      id: uid(),
      date: today,
      start: '07:30',
      end: '08:20',
      kind: 'study',
      subjectId: subDbmsId,
      taskId: '',
      title: 'Database Management Systems',
      topic: 'Normalization (1NF, 2NF, 3NF, BCNF)',
      label: 'Exam Prep',
      track: 'college',
      done: true,
      locked: false,
    },
    {
      id: uid(),
      date: today,
      start: '13:00',
      end: '13:45',
      kind: 'break',
      breakKind: 'meal',
      title: 'Lunch break',
      done: false,
      locked: false,
    },
    {
      id: uid(),
      date: today,
      start: '18:00',
      end: '18:50',
      kind: 'study',
      subjectId: subGateMathId,
      taskId: '',
      title: 'GATE - Engineering Mathematics',
      topic: 'Discrete Math: Graph Coloring & Relations',
      label: 'Practice Questions',
      track: 'exam',
      done: false,
      locked: false,
    },
    {
      id: uid(),
      date: today,
      start: '18:50',
      end: '19:00',
      kind: 'break',
      breakKind: 'short',
      title: 'Short break',
      done: false,
      locked: false,
    },
    {
      id: uid(),
      date: today,
      start: '19:00',
      end: '19:50',
      kind: 'study',
      subjectId: subOsId,
      taskId: '',
      title: 'Operating Systems',
      topic: 'Process Synchronization & Semaphores',
      label: 'Revision',
      track: 'college',
      done: false,
      locked: false,
    },
    {
      id: uid(),
      date: today,
      start: '20:00',
      end: '20:30',
      kind: 'break',
      breakKind: 'meal',
      title: 'Dinner break',
      done: false,
      locked: false,
    },
    {
      id: uid(),
      date: today,
      start: '20:30',
      end: '21:20',
      kind: 'study',
      subjectId: subGateTocId,
      taskId: '',
      title: 'GATE - Theory of Computation',
      topic: 'Regular Expressions & Pumping Lemma',
      label: 'Topic Study',
      track: 'exam',
      done: false,
      locked: false,
    },
    {
      id: uid(),
      date: addDays(today, 1),
      start: '06:30',
      end: '07:20',
      kind: 'study',
      subjectId: subCnId,
      taskId: '',
      title: 'Computer Networks',
      topic: 'IP Addressing, CIDR & Subnetting',
      label: 'Lab Prep',
      track: 'college',
      done: false,
      locked: false,
    },
    {
      id: uid(),
      date: addDays(today, 1),
      start: '07:20',
      end: '07:30',
      kind: 'break',
      breakKind: 'short',
      title: 'Short break',
      done: false,
      locked: false,
    },
    {
      id: uid(),
      date: addDays(today, 1),
      start: '07:30',
      end: '08:20',
      kind: 'study',
      subjectId: subDsaId,
      taskId: '',
      title: 'Data Structures & Algorithms',
      topic: 'Shortest Path Algorithms (Dijkstra)',
      label: 'Topic Study',
      track: 'college',
      done: false,
      locked: false,
    },
  ];

  return {
    profile: {
      name: 'Alex Morgan',
      college: 'National Institute of Technology',
      course: 'B.Tech Computer Science & Engineering (3rd Year)',
    },
    settings: {
      ...DEFAULT_SETTINGS,
      dailyGoal: 4.5,
    },
    availability: defaultAvailability(),
    commitments,
    holidays,
    subjects,
    exams,
    tasks,
    sessions,
    logs,
  };
}
