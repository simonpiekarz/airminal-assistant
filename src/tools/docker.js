// ═══════════════════════════════════════════════════════════════
// Empli Gateway — Docker Tools
// Containers, Images, Compose, Volumes, Networks, Logs
// Uses the Docker CLI (docker must be installed)
// ═══════════════════════════════════════════════════════════════

import { execSync } from 'child_process';

export const DOCKER_TOOL_DEFINITIONS = [
  // ═══ CONTAINERS ═══
  {
    name: 'docker_list_containers',
    description: 'List Docker containers. Shows running and optionally stopped containers with status, ports, image, and resource usage.',
    input_schema: {
      type: 'object',
      properties: {
        all: { type: 'boolean', description: 'Include stopped containers (default: false)' },
        filter: { type: 'string', description: 'Filter by name or image (optional)' },
      },
      required: [],
    },
  },
  {
    name: 'docker_run',
    description: 'Run a new Docker container from an image. Use for: starting services, running tools, testing environments.',
    input_schema: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Docker image (e.g. "nginx:latest", "postgres:16")' },
        name: { type: 'string', description: 'Container name (optional)' },
        ports: { type: 'array', items: { type: 'string' }, description: 'Port mappings (e.g. ["8080:80", "5432:5432"])' },
        env: { type: 'object', description: 'Environment variables as key-value pairs' },
        volumes: { type: 'array', items: { type: 'string' }, description: 'Volume mounts (e.g. ["./data:/data"])' },
        detach: { type: 'boolean', description: 'Run in background (default: true)' },
        command: { type: 'string', description: 'Override container command (optional)' },
        network: { type: 'string', description: 'Network to connect to (optional)' },
        restart: { type: 'string', enum: ['no', 'always', 'unless-stopped', 'on-failure'], description: 'Restart policy (default: "no")' },
      },
      required: ['image'],
    },
  },
  {
    name: 'docker_stop',
    description: 'Stop a running container.',
    input_schema: {
      type: 'object',
      properties: {
        container: { type: 'string', description: 'Container name or ID' },
        timeout: { type: 'number', description: 'Seconds to wait before force kill (default: 10)' },
      },
      required: ['container'],
    },
  },
  {
    name: 'docker_start',
    description: 'Start a stopped container.',
    input_schema: { type: 'object', properties: { container: { type: 'string', description: 'Container name or ID' } }, required: ['container'] },
  },
  {
    name: 'docker_restart',
    description: 'Restart a container.',
    input_schema: { type: 'object', properties: { container: { type: 'string', description: 'Container name or ID' } }, required: ['container'] },
  },
  {
    name: 'docker_remove',
    description: 'Remove a stopped container. CAUTION: data in non-volume mounts is lost.',
    input_schema: {
      type: 'object',
      properties: {
        container: { type: 'string', description: 'Container name or ID' },
        force: { type: 'boolean', description: 'Force remove even if running (default: false)' },
        volumes: { type: 'boolean', description: 'Also remove associated volumes (default: false)' },
      },
      required: ['container'],
    },
  },
  {
    name: 'docker_logs',
    description: 'Get logs from a container. Use for: debugging, monitoring, checking output.',
    input_schema: {
      type: 'object',
      properties: {
        container: { type: 'string', description: 'Container name or ID' },
        tail: { type: 'number', description: 'Number of lines from end (default: 100)' },
        since: { type: 'string', description: 'Show logs since timestamp or duration (e.g. "10m", "2h", "2026-01-01")' },
      },
      required: ['container'],
    },
  },
  {
    name: 'docker_exec',
    description: 'Execute a command inside a running container. Use for: debugging, running one-off commands, inspecting container state.',
    input_schema: {
      type: 'object',
      properties: {
        container: { type: 'string', description: 'Container name or ID' },
        command: { type: 'string', description: 'Command to execute (e.g. "ls -la /app", "cat /etc/hosts")' },
      },
      required: ['container', 'command'],
    },
  },
  {
    name: 'docker_inspect',
    description: 'Get detailed info about a container: config, network, mounts, state.',
    input_schema: {
      type: 'object',
      properties: {
        container: { type: 'string', description: 'Container name or ID' },
      },
      required: ['container'],
    },
  },
  {
    name: 'docker_stats',
    description: 'Get real-time resource usage (CPU, memory, network, disk I/O) for running containers.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },

  // ═══ IMAGES ═══
  {
    name: 'docker_list_images',
    description: 'List Docker images on the machine.',
    input_schema: { type: 'object', properties: { filter: { type: 'string', description: 'Filter by name (optional)' } }, required: [] },
  },
  {
    name: 'docker_pull',
    description: 'Pull a Docker image from a registry.',
    input_schema: {
      type: 'object',
      properties: { image: { type: 'string', description: 'Image to pull (e.g. "node:20", "postgres:16-alpine")' } },
      required: ['image'],
    },
  },
  {
    name: 'docker_build',
    description: 'Build a Docker image from a Dockerfile.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Build context path (directory with Dockerfile)' },
        tag: { type: 'string', description: 'Image tag (e.g. "myapp:latest")' },
        dockerfile: { type: 'string', description: 'Dockerfile path (default: "Dockerfile")' },
      },
      required: ['path', 'tag'],
    },
  },

  // ═══ COMPOSE ═══
  {
    name: 'docker_compose_up',
    description: 'Start services defined in a docker-compose.yml file.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to directory with docker-compose.yml' },
        services: { type: 'array', items: { type: 'string' }, description: 'Specific services to start (optional, default: all)' },
        detach: { type: 'boolean', description: 'Run in background (default: true)' },
        build: { type: 'boolean', description: 'Build images before starting (default: false)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'docker_compose_down',
    description: 'Stop and remove compose services.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to docker-compose.yml directory' },
        volumes: { type: 'boolean', description: 'Also remove volumes (default: false)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'docker_compose_ps',
    description: 'List status of compose services.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Path to docker-compose.yml directory' } },
      required: ['path'],
    },
  },

  // ═══ NETWORKS & VOLUMES ═══
  {
    name: 'docker_list_networks',
    description: 'List Docker networks.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'docker_list_volumes',
    description: 'List Docker volumes.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'docker_system_prune',
    description: 'Clean up unused Docker resources (stopped containers, unused images, networks). CAUTION: confirm with user.',
    input_schema: {
      type: 'object',
      properties: {
        all: { type: 'boolean', description: 'Remove all unused images, not just dangling (default: false)' },
        volumes: { type: 'boolean', description: 'Also prune volumes (default: false)' },
      },
      required: [],
    },
  },
];


export class DockerToolExecutor {
  constructor(config = {}) {
    this.config = config;
  }

  async execute(toolName, input) {
    try {
      // Check docker is available
      execSync('docker --version', { encoding: 'utf-8', timeout: 5000 });
    } catch {
      return { error: 'Docker is not installed or not in PATH.' };
    }

    try {
      switch (toolName) {
        case 'docker_list_containers': return this.listContainers(input);
        case 'docker_run': return this.run(input);
        case 'docker_stop': return this.cmd(`docker stop ${input.timeout ? `-t ${input.timeout}` : ''} ${input.container}`);
        case 'docker_start': return this.cmd(`docker start ${input.container}`);
        case 'docker_restart': return this.cmd(`docker restart ${input.container}`);
        case 'docker_remove': return this.cmd(`docker rm ${input.force ? '-f' : ''} ${input.volumes ? '-v' : ''} ${input.container}`);
        case 'docker_logs': return this.logs(input);
        case 'docker_exec': return this.cmd(`docker exec ${input.container} ${input.command}`);
        case 'docker_inspect': return this.inspect(input);
        case 'docker_stats': return this.cmd('docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"');
        case 'docker_list_images': return this.cmd(`docker images ${input.filter ? `"*${input.filter}*"` : ''} --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}"`);
        case 'docker_pull': return this.cmd(`docker pull ${input.image}`, 120);
        case 'docker_build': return this.cmd(`docker build -t ${input.tag} ${input.dockerfile ? `-f ${input.dockerfile}` : ''} ${input.path}`, 300);
        case 'docker_compose_up': return this.composeUp(input);
        case 'docker_compose_down': return this.cmd(`docker compose -f ${input.path}/docker-compose.yml down ${input.volumes ? '-v' : ''}`);
        case 'docker_compose_ps': return this.cmd(`docker compose -f ${input.path}/docker-compose.yml ps`);
        case 'docker_list_networks': return this.cmd('docker network ls --format "table {{.Name}}\t{{.Driver}}\t{{.Scope}}"');
        case 'docker_list_volumes': return this.cmd('docker volume ls --format "table {{.Name}}\t{{.Driver}}\t{{.Mountpoint}}"');
        case 'docker_system_prune': return this.cmd(`docker system prune -f ${input.all ? '-a' : ''} ${input.volumes ? '--volumes' : ''}`);
        default: return { error: `Unknown Docker tool: ${toolName}` };
      }
    } catch (err) {
      return { error: `${toolName} failed: ${err.message}` };
    }
  }

  cmd(command, timeout = 30) {
    try {
      const result = execSync(command, { encoding: 'utf-8', timeout: timeout * 1000, maxBuffer: 1024 * 1024 * 5 });
      return { output: result.trim() || '(success, no output)' };
    } catch (err) {
      return { output: (err.stdout || '') + (err.stderr || ''), error: err.message };
    }
  }

  listContainers(input) {
    const { all = false, filter } = input;
    let cmd = `docker ps ${all ? '-a' : ''} --format "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"`;
    if (filter) cmd += ` --filter "name=${filter}"`;
    const result = execSync(cmd, { encoding: 'utf-8', timeout: 10000 });
    const containers = result.trim().split('\n').filter(Boolean).map(line => {
      const [id, name, image, status, ports] = line.split('\t');
      return { id, name, image, status, ports };
    });
    return { containers, count: containers.length };
  }

  run(input) {
    const { image, name, ports, env, volumes, detach = true, command, network, restart } = input;
    let cmd = `docker run ${detach ? '-d' : ''}`;
    if (name) cmd += ` --name ${name}`;
    if (restart) cmd += ` --restart ${restart}`;
    if (network) cmd += ` --network ${network}`;
    if (ports) ports.forEach(p => { cmd += ` -p ${p}`; });
    if (env) Object.entries(env).forEach(([k, v]) => { cmd += ` -e ${k}="${v}"`; });
    if (volumes) volumes.forEach(v => { cmd += ` -v ${v}`; });
    cmd += ` ${image}`;
    if (command) cmd += ` ${command}`;
    return this.cmd(cmd, 120);
  }

  logs(input) {
    const { container, tail = 100, since } = input;
    let cmd = `docker logs --tail ${tail}`;
    if (since) cmd += ` --since ${since}`;
    cmd += ` ${container}`;
    return this.cmd(cmd);
  }

  inspect(input) {
    const raw = execSync(`docker inspect ${input.container}`, { encoding: 'utf-8', timeout: 10000 });
    const data = JSON.parse(raw)[0];
    return {
      name: data.Name?.replace('/', ''),
      image: data.Config?.Image,
      status: data.State?.Status,
      started: data.State?.StartedAt,
      ports: data.NetworkSettings?.Ports,
      env: data.Config?.Env?.filter(e => !e.includes('PASSWORD') && !e.includes('SECRET')),
      mounts: data.Mounts?.map(m => ({ source: m.Source, dest: m.Destination, mode: m.Mode })),
      network: Object.keys(data.NetworkSettings?.Networks || {}),
      restart_policy: data.HostConfig?.RestartPolicy?.Name,
    };
  }

  composeUp(input) {
    const { path: composePath, services, detach = true, build } = input;
    let cmd = `docker compose -f ${composePath}/docker-compose.yml up`;
    if (detach) cmd += ' -d';
    if (build) cmd += ' --build';
    if (services?.length) cmd += ' ' + services.join(' ');
    return this.cmd(cmd, 300);
  }
}
