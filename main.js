const express = require('express');
const pm2 = require('pm2');
const app = express();
const PORT = 3090;

app.use(express.static('public')); // Serve static files from the public directory
app.use(express.json()); // Middleware to parse JSON bodies

// Function to get PM2 process info
const getProcessInfo = () => {
    return new Promise((resolve, reject) => {
        pm2.list((err, processList) => {
            if (err) {
                reject(err);
            } else {
                const processes = processList.map(process => ({
                    name: process.name,
                    pid: process.pid,
                    version: process.pm2_env.version,
                    uptime: process.pm2_env.pm_uptime,
                    cpu: process.monit.cpu,
                    memory: process.monit.memory,
                    status: process.pm2_env.status, // Include status for buttons
                    isCluster: process.pm2_env.exec_mode === 'cluster' // Check if it's a cluster
                }));
                resolve(processes);
            }
        });
    });
};

// API endpoint to get process info
app.get('/api/processes', async (req, res) => {
    try {
        const processes = await getProcessInfo();
        res.json(processes);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// API endpoint to start or stop a process by name
// Extend the existing API endpoint to handle scaling
app.post('/api/process/:action', (req, res) => {
    const { name, instances } = req.body; // Expect instances in the request body for scaling
    const action = req.params.action;

    if (action === 'start') {
        pm2.start(name, (err) => {
            if (err) return res.status(500).send(err.message);
            res.send({ message: `Started process: ${name}` });
        });
    } else if (action === 'stop') {
        pm2.stop(name, (err) => {
            if (err) return res.status(500).send(err.message);
            res.send({ message: `Stopped process: ${name}` });
        });
    } else if (action === 'restart') {
        pm2.restart(name, (err) => {
            if (err) return res.status(500).send(err.message);
            res.send({ message: `Restarted process: ${name}` });
        });
    } else if (action === 'scale') {
        if (!instances || instances < 1) {
            return res.status(400).send({ message: "Invalid number of instances" });
        }
        pm2.scale(name, instances, (err) => {
            if (err) return res.status(500).send(err.message);
            res.send({ message: `Scaled process: ${name} to ${instances} instances` });
        });
    } else {
        res.status(400).send({ message: `Unsupported action: ${action}` });
    }
});


// API endpoint to delete a stopped process by name
app.delete('/api/process/:name', (req, res) => {
    const { name } = req.params;

    pm2.delete(name, (err) => {
        if (err) return res.status(500).send(err.message);
        res.send({ message: `Deleted process: ${name}` });
    });
});

// API endpoint to stop all instances of a cluster
app.post('/api/process/stop-cluster', (req, res) => {
    const { name } = req.body;

    pm2.stop(name, (err) => {
        if (err) return res.status(500).send(err.message);
        res.send({ message: `Stopped all instances of cluster: ${name}` });
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});


pm2.connect(err => {
    if (err) {
        console.error('Error connecting to PM2:', err);
        process.exit(2);
    }
});
