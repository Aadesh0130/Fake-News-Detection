// NUMA Simulator Application Logic

const state = {
    isRunning: true,
    cpuNodes: 4,
    memNodes: 4,
    memSize: 16, // GB per node
    baseLatency: 100, // ns
    strategy: 'local', // local, interleaved, random
    processes: [],
    topologyNodes: [],
    topologyEdges: [],
    history: { latency: [] }
};

// DOM Elements
const els = {
    btnStartPause: document.getElementById('btn-start-pause'),
    btnReset: document.getElementById('btn-reset'),
    simStatusText: document.getElementById('sim-status-text'),
    pulseDot: document.querySelector('.pulse-dot'),
    
    sliderCpuNodes: document.getElementById('slider-cpu-nodes'),
    valCpuNodes: document.getElementById('val-cpu-nodes'),
    sliderMemSize: document.getElementById('slider-mem-size'),
    valMemSize: document.getElementById('val-mem-size'),
    sliderLatency: document.getElementById('slider-latency'),
    valLatency: document.getElementById('val-latency'),
    strategySelect: document.getElementById('strategy-select'),

    statCpus: document.getElementById('stat-cpus'),
    statMems: document.getElementById('stat-mems'),
    statProcs: document.getElementById('stat-procs'),
    statLat: document.getElementById('stat-lat'),

    cpuList: document.getElementById('cpu-node-list'),
    memList: document.getElementById('mem-node-list'),
    procList: document.getElementById('process-list'),
    
    heatmap: document.getElementById('memory-heatmap'),
    procTableBody: document.getElementById('process-table-body'),
    
    canvasTopology: document.getElementById('topology-canvas'),
    canvasLatency: document.getElementById('latency-chart'),
    barChart: document.getElementById('memory-dist-chart'),
    
    topoTooltip: document.getElementById('topology-tooltip')
};

// Canvas Contexts
const ctxTopo = els.canvasTopology.getContext('2d');
const ctxLat = els.canvasLatency.getContext('2d');

let animationFrameId;
let simulationIntervalId;

// Initialize Application
function init() {
    setupEventListeners();
    handleResize();
    window.addEventListener('resize', handleResize);
    resetSimulation();
    renderLoop();
}

// Event Listeners
function setupEventListeners() {
    els.btnStartPause.addEventListener('click', () => {
        state.isRunning = !state.isRunning;
        els.simStatusText.textContent = state.isRunning ? 'Running' : 'Paused';
        els.btnStartPause.innerHTML = state.isRunning ? '<i class="fa-solid fa-pause"></i> Pause' : '<i class="fa-solid fa-play"></i> Start';
        els.pulseDot.style.animationPlayState = state.isRunning ? 'running' : 'paused';
        els.pulseDot.style.background = state.isRunning ? 'var(--neon-green)' : 'var(--text-secondary)';
        els.pulseDot.style.boxShadow = state.isRunning ? '0 0 8px var(--neon-green)' : 'none';
        els.simStatusText.parentElement.style.color = state.isRunning ? 'var(--neon-green)' : 'var(--text-secondary)';
    });

    els.btnReset.addEventListener('click', resetSimulation);

    els.sliderCpuNodes.addEventListener('input', (e) => {
        state.cpuNodes = parseInt(e.target.value);
        state.memNodes = state.cpuNodes; // Keep symmetric for simplicity
        els.valCpuNodes.textContent = state.cpuNodes;
        els.statCpus.textContent = state.cpuNodes;
        els.statMems.textContent = state.memNodes;
        generateTopology();
        updateSidebar();
    });

    els.sliderMemSize.addEventListener('input', (e) => {
        state.memSize = parseInt(e.target.value);
        els.valMemSize.textContent = state.memSize;
        generateHeatmap();
    });

    els.sliderLatency.addEventListener('input', (e) => {
        state.baseLatency = parseInt(e.target.value);
        els.valLatency.textContent = state.baseLatency;
    });

    els.strategySelect.addEventListener('change', (e) => {
        state.strategy = e.target.value;
    });

    // Topology Hover
    els.canvasTopology.addEventListener('mousemove', handleTopoHover);
    els.canvasTopology.addEventListener('mouseout', () => els.topoTooltip.classList.add('hidden'));
}

function handleResize() {
    const topoRect = els.canvasTopology.parentElement.getBoundingClientRect();
    els.canvasTopology.width = topoRect.width;
    els.canvasTopology.height = topoRect.height;
    
    const latRect = els.canvasLatency.parentElement.getBoundingClientRect();
    els.canvasLatency.width = latRect.width;
    els.canvasLatency.height = latRect.height || 120;
    
    generateTopology();
}

// Simulation Logic
function resetSimulation() {
    state.processes = [];
    state.history.latency = Array(20).fill(state.baseLatency);
    
    // Create initial dummy processes
    for(let i=0; i<12; i++) {
        spawnProcess();
    }
    
    generateTopology();
    updateSidebar();
    generateHeatmap();
    updateProcessTable();
    
    if (simulationIntervalId) clearInterval(simulationIntervalId);
    simulationIntervalId = setInterval(simulationTick, 1000);
}

function spawnProcess() {
    const pid = Math.floor(Math.random() * 9000) + 1000;
    const cpuNode = Math.floor(Math.random() * state.cpuNodes);
    let memNode;
    
    if(state.strategy === 'local') {
        memNode = cpuNode;
    } else if (state.strategy === 'interleaved') {
        memNode = (cpuNode + 1) % state.memNodes;
    } else {
        memNode = Math.floor(Math.random() * state.memNodes);
    }
    
    const latency = cpuNode === memNode ? state.baseLatency / 2 : state.baseLatency + (Math.abs(cpuNode - memNode) * 20);
    
    state.processes.push({
        id: `P-${pid}`,
        cpuNode,
        memNode,
        memUsed: Math.floor(Math.random() * 1024) + 128, // MB
        latency,
        status: Math.random() > 0.2 ? 'Active' : 'Waiting',
        color: `hsl(${Math.random() * 360}, 70%, 60%)`
    });
}

function simulationTick() {
    if (!state.isRunning) return;

    // Randomly spawn/kill processes
    if (Math.random() > 0.7 && state.processes.length < 20) spawnProcess();
    if (Math.random() > 0.8 && state.processes.length > 5) state.processes.splice(Math.floor(Math.random() * state.processes.length), 1);

    // Update statuses
    let totalLat = 0;
    state.processes.forEach(p => {
        if(Math.random() > 0.8) p.status = p.status === 'Active' ? 'Waiting' : 'Active';
        
        // Recalculate latency with jitter
        const baseLat = p.cpuNode === p.memNode ? state.baseLatency / 2 : state.baseLatency + (Math.abs(p.cpuNode - p.memNode) * 20);
        p.latency = baseLat + (Math.random() * 10 - 5);
        totalLat += p.latency;
    });

    const avgLat = state.processes.length ? Math.round(totalLat / state.processes.length) : 0;
    
    // Update Stats
    els.statProcs.textContent = state.processes.length;
    els.statLat.innerHTML = `${avgLat}<small>ns</small>`;
    
    // Update History
    state.history.latency.push(avgLat);
    if(state.history.latency.length > 20) state.history.latency.shift();

    updateProcessTable();
    updateSidebarProcs();
    updateBarChart();
    updateHeatmap();
}

// Topology Visualization
function generateTopology() {
    const w = els.canvasTopology.width;
    const h = els.canvasTopology.height;
    state.topologyNodes = [];
    state.topologyEdges = [];

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.35;

    // Create Nodes in a circle
    const totalNodes = state.cpuNodes * 2; // CPU + Mem
    for(let i=0; i<totalNodes; i++) {
        const angle = (i / totalNodes) * Math.PI * 2 - Math.PI / 2;
        const isCpu = i % 2 === 0;
        const nodeIdx = Math.floor(i/2);
        
        state.topologyNodes.push({
            id: isCpu ? `CPU-${nodeIdx}` : `MEM-${nodeIdx}`,
            type: isCpu ? 'cpu' : 'mem',
            nodeIdx,
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
            r: 20
        });
    }

    // Create Edges
    for(let i=0; i<state.topologyNodes.length; i++) {
        for(let j=i+1; j<state.topologyNodes.length; j++) {
            const n1 = state.topologyNodes[i];
            const n2 = state.topologyNodes[j];
            
            // Connect CPU to its local Mem
            let isLocal = (n1.nodeIdx === n2.nodeIdx) && (n1.type !== n2.type);
            // Connect all CPUs to each other
            let isInterCpu = n1.type === 'cpu' && n2.type === 'cpu';
            // Connect CPUs to remote mems
            let isRemote = n1.type !== n2.type && !isLocal;

            if (isLocal || isInterCpu || isRemote) {
                state.topologyEdges.push({
                    source: n1,
                    target: n2,
                    type: isLocal ? 'local' : (isInterCpu ? 'qpi' : 'remote'),
                    latency: isLocal ? state.baseLatency / 2 : state.baseLatency + 20
                });
            }
        }
    }
}

function handleTopoHover(e) {
    const rect = els.canvasTopology.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    let hoveredEdge = null;
    
    // Simple edge collision detection
    for(let edge of state.topologyEdges) {
        const dx1 = edge.source.x - x;
        const dy1 = edge.source.y - y;
        const d1 = Math.sqrt(dx1*dx1 + dy1*dy1);
        
        const dx2 = edge.target.x - x;
        const dy2 = edge.target.y - y;
        const d2 = Math.sqrt(dx2*dx2 + dy2*dy2);
        
        const dx3 = edge.source.x - edge.target.x;
        const dy3 = edge.source.y - edge.target.y;
        const edgeLen = Math.sqrt(dx3*dx3 + dy3*dy3);
        
        if (d1 + d2 >= edgeLen - 0.5 && d1 + d2 <= edgeLen + 0.5) {
            hoveredEdge = edge;
            break;
        }
    }

    if (hoveredEdge) {
        els.topoTooltip.classList.remove('hidden');
        els.topoTooltip.style.left = `${x}px`;
        els.topoTooltip.style.top = `${y}px`;
        els.topoTooltip.querySelector('span').textContent = Math.round(hoveredEdge.latency);
        state.hoveredEdge = hoveredEdge;
    } else {
        els.topoTooltip.classList.add('hidden');
        state.hoveredEdge = null;
    }
}

function drawTopology() {
    ctxTopo.clearRect(0, 0, els.canvasTopology.width, els.canvasTopology.height);

    // Draw Edges
    state.topologyEdges.forEach(edge => {
        ctxTopo.beginPath();
        ctxTopo.moveTo(edge.source.x, edge.source.y);
        ctxTopo.lineTo(edge.target.x, edge.target.y);
        
        let alpha = edge.type === 'local' ? 0.6 : 0.1;
        let color = edge.type === 'local' ? '#10b981' : (edge.type === 'qpi' ? '#3b82f6' : '#ef4444');
        let width = edge.type === 'local' ? 2 : 1;

        if (state.hoveredEdge === edge) {
            alpha = 1;
            width = 3;
            color = '#06b6d4'; // Cyan glow
            ctxTopo.shadowBlur = 10;
            ctxTopo.shadowColor = color;
        } else {
            ctxTopo.shadowBlur = 0;
        }

        ctxTopo.strokeStyle = color;
        ctxTopo.globalAlpha = alpha;
        ctxTopo.lineWidth = width;
        ctxTopo.stroke();
    });
    ctxTopo.globalAlpha = 1;
    ctxTopo.shadowBlur = 0;

    // Draw Nodes
    state.topologyNodes.forEach(node => {
        ctxTopo.beginPath();
        ctxTopo.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        
        const isCpu = node.type === 'cpu';
        const color = isCpu ? '#3b82f6' : '#8b5cf6'; // Blue for CPU, Purple for Mem
        
        ctxTopo.fillStyle = '#0f172a'; // dark bg
        ctxTopo.fill();
        
        ctxTopo.lineWidth = 3;
        ctxTopo.strokeStyle = color;
        ctxTopo.stroke();

        // Icon or Text
        ctxTopo.fillStyle = '#fff';
        ctxTopo.font = '10px "Fira Code"';
        ctxTopo.textAlign = 'center';
        ctxTopo.textBaseline = 'middle';
        ctxTopo.fillText(isCpu ? `C${node.nodeIdx}` : `M${node.nodeIdx}`, node.x, node.y);
        
        // Active pulse effect for CPUs
        if (isCpu && state.isRunning) {
            const time = Date.now() / 500;
            const pulseR = node.r + Math.sin(time + node.nodeIdx) * 5;
            ctxTopo.beginPath();
            ctxTopo.arc(node.x, node.y, pulseR, 0, Math.PI * 2);
            ctxTopo.strokeStyle = `rgba(59, 130, 246, 0.3)`;
            ctxTopo.lineWidth = 1;
            ctxTopo.stroke();
        }
    });
}

// Memory Heatmap
function generateHeatmap() {
    els.heatmap.innerHTML = '';
    const cellsTotal = state.memNodes * 64; // arbitrary visual granularity
    
    for(let i=0; i<cellsTotal; i++) {
        const cell = document.createElement('div');
        cell.className = 'heat-cell';
        els.heatmap.appendChild(cell);
    }
}

function updateHeatmap() {
    const cells = els.heatmap.children;
    if(!cells.length) return;
    
    // Reset
    for(let c of cells) {
        c.className = 'heat-cell';
    }

    // Assign activity based on processes
    state.processes.forEach(p => {
        if(p.status === 'Active') {
            const nodeOffset = p.memNode * 64;
            const cellsToLight = Math.ceil((p.memUsed / 1024) * 16); // Normalize
            
            for(let i=0; i<cellsToLight; i++) {
                const targetIdx = nodeOffset + Math.floor(Math.random() * 64);
                if(cells[targetIdx]) {
                    const level = Math.floor(Math.random() * 4) + 1;
                    cells[targetIdx].classList.add(`level-${level}`);
                }
            }
        }
    });
}

// UI Updaters
function updateSidebar() {
    els.cpuList.innerHTML = '';
    els.memList.innerHTML = '';
    
    for(let i=0; i<state.cpuNodes; i++) {
        els.cpuList.innerHTML += `<li><span><i class="fa-solid fa-microchip neon-text-blue"></i> Node ${i}</span> <small>Idle</small></li>`;
        els.memList.innerHTML += `<li><span><i class="fa-solid fa-memory neon-text-purple"></i> Bank ${i}</span> <small>${state.memSize} GB</small></li>`;
    }
    updateSidebarProcs();
}

function updateSidebarProcs() {
    els.procList.innerHTML = '';
    state.processes.slice(0, 5).forEach(p => {
        els.procList.innerHTML += `<li><span><i class="fa-solid fa-gear" style="color:${p.color}"></i> ${p.id}</span> <small>${p.memUsed}MB</small></li>`;
    });
    if(state.processes.length > 5) {
        els.procList.innerHTML += `<li style="justify-content:center"><small>+${state.processes.length - 5} more...</small></li>`;
    }
}

function updateProcessTable() {
    els.procTableBody.innerHTML = '';
    state.processes.forEach(p => {
        const tr = document.createElement('tr');
        const statusClass = p.status === 'Active' ? 'status-active' : 'status-waiting';
        tr.innerHTML = `
            <td><span style="color:${p.color}">●</span> ${p.id}</td>
            <td>CPU ${p.cpuNode} → Mem ${p.memNode}</td>
            <td>${p.memUsed} MB</td>
            <td>${Math.round(p.latency)} ns</td>
            <td><span class="status-badge ${statusClass}">${p.status}</span></td>
        `;
        els.procTableBody.appendChild(tr);
    });
}

function drawLatencyChart() {
    const w = els.canvasLatency.width;
    const h = els.canvasLatency.height;
    ctxLat.clearRect(0, 0, w, h);
    
    if(state.history.latency.length < 2) return;

    const maxLat = Math.max(...state.history.latency, 200) * 1.2;
    const stepX = w / (state.history.latency.length - 1);
    
    ctxLat.beginPath();
    ctxLat.moveTo(0, h - (state.history.latency[0] / maxLat) * h);
    
    for(let i=1; i<state.history.latency.length; i++) {
        ctxLat.lineTo(i * stepX, h - (state.history.latency[i] / maxLat) * h);
    }
    
    ctxLat.strokeStyle = '#06b6d4';
    ctxLat.lineWidth = 2;
    ctxLat.shadowBlur = 8;
    ctxLat.shadowColor = '#06b6d4';
    ctxLat.stroke();
    
    // Fill under line
    ctxLat.lineTo(w, h);
    ctxLat.lineTo(0, h);
    const gradient = ctxLat.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(6, 182, 212, 0.2)');
    gradient.addColorStop(1, 'rgba(6, 182, 212, 0)');
    ctxLat.fillStyle = gradient;
    ctxLat.fill();
}

function updateBarChart() {
    els.barChart.innerHTML = '';
    // Calculate usage per node
    const usage = Array(state.memNodes).fill(0);
    state.processes.forEach(p => {
        if(usage[p.memNode] !== undefined) {
            usage[p.memNode] += p.memUsed;
        }
    });
    
    const maxUse = Math.max(...usage, 1024);
    
    usage.forEach((u, i) => {
        const heightPct = Math.max((u / maxUse) * 100, 5);
        els.barChart.innerHTML += `<div class="bar" style="height: ${heightPct}%" title="Node ${i}: ${u}MB"></div>`;
    });
}

// Main Render Loop
function renderLoop() {
    drawTopology();
    drawLatencyChart();
    animationFrameId = requestAnimationFrame(renderLoop);
}

// Start app
document.addEventListener('DOMContentLoaded', init);
