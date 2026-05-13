import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Workflow,
  Plus,
  Search,
  Play,
  Pause,
  Edit,
  Trash2,
  Copy,
  CheckCircle,
  AlertCircle,
  GitBranch,
  Zap,
  Activity,
  PlayCircle,
  History,
} from 'lucide-react';

interface WorkflowItem {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'draft' | 'error';
  trigger: 'manual' | 'scheduled' | 'webhook' | 'event';
  lastRun: string;
  runCount: number;
  successRate: number;
  nodes: number;
  createdAt: string;
  tags: string[];
}

interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'success' | 'failed' | 'running';
  startedAt: string;
  duration: string;
  trigger: string;
}

const mockWorkflows: WorkflowItem[] = [
  {
    id: '1',
    name: 'Customer Onboarding',
    description: 'Automated welcome email, account setup, and tutorial sequence for new users',
    status: 'active',
    trigger: 'event',
    lastRun: '5 min ago',
    runCount: 1245,
    successRate: 98.5,
    nodes: 8,
    createdAt: '2024-01-15',
    tags: ['Onboarding', 'Email', 'Automation'],
  },
  {
    id: '2',
    name: 'Daily Report Generator',
    description: 'Collects data from multiple sources and generates comprehensive daily reports',
    status: 'active',
    trigger: 'scheduled',
    lastRun: '2 hours ago',
    runCount: 520,
    successRate: 95.2,
    nodes: 12,
    createdAt: '2024-01-20',
    tags: ['Reporting', 'Data', 'Scheduled'],
  },
  {
    id: '3',
    name: 'Lead Qualification',
    description: 'Evaluates and scores leads based on form submissions and behavior',
    status: 'paused',
    trigger: 'webhook',
    lastRun: '1 day ago',
    runCount: 3200,
    successRate: 92.0,
    nodes: 6,
    createdAt: '2024-02-01',
    tags: ['Sales', 'CRM', 'Qualification'],
  },
  {
    id: '4',
    name: 'Content Publishing Pipeline',
    description: 'Content review, approval, and multi-channel publishing workflow',
    status: 'draft',
    trigger: 'manual',
    lastRun: 'Never',
    runCount: 0,
    successRate: 100,
    nodes: 15,
    createdAt: '2024-02-10',
    tags: ['Content', 'Publishing', 'Review'],
  },
  {
    id: '5',
    name: 'Invoice Processing',
    description: 'Automated invoice validation, approval routing, and payment processing',
    status: 'error',
    trigger: 'webhook',
    lastRun: '3 hours ago',
    runCount: 890,
    successRate: 87.5,
    nodes: 10,
    createdAt: '2024-02-05',
    tags: ['Finance', 'Invoice', 'Processing'],
  },
];

const mockRuns: WorkflowRun[] = [
  {
    id: 'run-001',
    workflowId: '1',
    status: 'success',
    startedAt: '2024-02-15 14:30',
    duration: '2m 15s',
    trigger: 'User signup',
  },
  {
    id: 'run-002',
    workflowId: '2',
    status: 'success',
    startedAt: '2024-02-15 09:00',
    duration: '5m 30s',
    trigger: 'Scheduled',
  },
  {
    id: 'run-003',
    workflowId: '3',
    status: 'failed',
    startedAt: '2024-02-15 08:45',
    duration: '1m 10s',
    trigger: 'Form submission',
  },
];

const triggerIcons = {
  manual: PlayCircle,
  scheduled: Clock,
  webhook: Zap,
  event: Activity,
};

const triggerLabels = {
  manual: 'Manual',
  scheduled: 'Scheduled',
  webhook: 'Webhook',
  event: 'Event',
};

import { Clock } from 'lucide-react';

export default function MyWorkflows() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>(mockWorkflows);
  const [filteredWorkflows, setFilteredWorkflows] = useState<WorkflowItem[]>(mockWorkflows);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    trigger: 'manual' as WorkflowItem['trigger'],
  });
  const [activeTab, setActiveTab] = useState<'workflows' | 'runs'>('workflows');

  const token = localStorage.getItem('token');
  const isAuthenticated = !!token;

  const stats = [
    { label: 'Total Workflows', value: workflows.length.toString(), icon: Workflow },
    {
      label: 'Active',
      value: workflows.filter((w) => w.status === 'active').length.toString(),
      icon: Activity,
    },
    {
      label: 'Total Runs',
      value: workflows.reduce((acc, w) => acc + w.runCount, 0).toLocaleString(),
      icon: History,
    },
    {
      label: 'Success Rate',
      value: '94.3%',
      icon: CheckCircle,
    },
  ];

  useEffect(() => {
    let result = [...workflows];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (wf) =>
          wf.name.toLowerCase().includes(query) ||
          wf.description.toLowerCase().includes(query) ||
          wf.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    if (selectedStatus !== 'all') {
      result = result.filter((wf) => wf.status === selectedStatus);
    }

    setFilteredWorkflows(result);
  }, [workflows, searchQuery, selectedStatus]);

  const handleToggleStatus = (workflowId: string) => {
    setWorkflows((prev) =>
      prev.map((wf) => {
        if (wf.id === workflowId) {
          const newStatus = wf.status === 'active' ? 'paused' : 'active';
          return { ...wf, status: newStatus };
        }
        return wf;
      })
    );
  };

  const handleDeleteWorkflow = (workflowId: string) => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      setWorkflows((prev) => prev.filter((wf) => wf.id !== workflowId));
    }
  };

  const handleDuplicateWorkflow = (workflow: WorkflowItem) => {
    const duplicated: WorkflowItem = {
      ...workflow,
      id: Date.now().toString(),
      name: `${workflow.name} (Copy)`,
      status: 'draft',
      createdAt: new Date().toISOString().split('T')[0],
      lastRun: 'Never',
      runCount: 0,
      successRate: 100,
    };
    setWorkflows((prev) => [duplicated, ...prev]);
  };

  const handleCreateWorkflow = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const newWorkflow: WorkflowItem = {
      id: Date.now().toString(),
      name: createForm.name,
      description: createForm.description,
      status: 'draft',
      trigger: createForm.trigger,
      lastRun: 'Never',
      runCount: 0,
      successRate: 100,
      nodes: 3,
      createdAt: new Date().toISOString().split('T')[0],
      tags: ['Custom'],
    };
    setWorkflows((prev) => [newWorkflow, ...prev]);
    setIsCreateModalOpen(false);
    setCreateForm({ name: '', description: '', trigger: 'manual' });
  };

  const handleRunWorkflow = (workflowId: string) => {
    setWorkflows((prev) =>
      prev.map((wf) =>
        wf.id === workflowId
          ? { ...wf, lastRun: 'Just now', runCount: wf.runCount + 1 }
          : wf
      )
    );
    alert('Workflow started! Check the Runs tab for status.');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'paused':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'draft':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'error':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getRunStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'running':
        return 'text-blue-600';
      default:
        return 'text-slate-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Workflows</h1>
            <p className="mt-1 text-slate-600">Create and manage automated workflows</p>
          </div>
          {isAuthenticated && (
            <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Workflow
            </Button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100">
                    <stat.icon className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                    <p className="text-xs text-slate-500">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'workflows' ? 'default' : 'outline'}
              onClick={() => setActiveTab('workflows')}
              size="sm"
            >
              <Workflow className="mr-2 h-4 w-4" />
              Workflows
            </Button>
            <Button
              variant={activeTab === 'runs' ? 'default' : 'outline'}
              onClick={() => setActiveTab('runs')}
              size="sm"
            >
              <History className="mr-2 h-4 w-4" />
              Recent Runs
            </Button>
          </div>
        </div>

        {activeTab === 'workflows' ? (
          <>
            {/* Filters */}
            <Card className="mb-6 border-slate-200">
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search workflows..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex gap-2">
                    {['all', 'active', 'paused', 'draft', 'error'].map((status) => (
                      <Button
                        key={status}
                        variant={selectedStatus === status ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedStatus(status)}
                        className="capitalize"
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Workflows Grid */}
            {filteredWorkflows.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="py-12 text-center">
                  <Workflow className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                  <h3 className="mb-2 text-lg font-medium text-slate-900">
                    {searchQuery ? 'No workflows found' : 'No workflows yet'}
                  </h3>
                  <p className="mb-4 text-slate-500">
                    {searchQuery
                      ? 'Try adjusting your search'
                      : 'Create your first workflow to get started'}
                  </p>
                  {!searchQuery && isAuthenticated && (
                    <Button onClick={() => setIsCreateModalOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create First Workflow
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {filteredWorkflows.map((workflow) => {
                  const TriggerIcon = triggerIcons[workflow.trigger];
                  return (
                    <Card
                      key={workflow.id}
                      className="group border-slate-200 transition-all duration-300 hover:shadow-lg"
                    >
                      <CardHeader className="pb-3">
                        <div className="mb-2 flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
                              <GitBranch className="h-5 w-5" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{workflow.name}</CardTitle>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <TriggerIcon className="h-3 w-3" />
                                {triggerLabels[workflow.trigger]}
                              </div>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={getStatusColor(workflow.status)}
                          >
                            {workflow.status}
                          </Badge>
                        </div>
                        <CardDescription className="line-clamp-2">
                          {workflow.description}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="pb-3">
                        <div className="mb-4 flex flex-wrap gap-2">
                          {workflow.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div className="grid grid-cols-4 gap-2 rounded-lg bg-slate-50 p-3 text-center text-sm">
                          <div>
                            <p className="text-lg font-semibold text-slate-900">
                              {workflow.nodes}
                            </p>
                            <p className="text-xs text-slate-500">Nodes</p>
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-slate-900">
                              {workflow.runCount.toLocaleString()}
                            </p>
                            <p className="text-xs text-slate-500">Runs</p>
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-slate-900">
                              {workflow.successRate}%
                            </p>
                            <p className="text-xs text-slate-500">Success</p>
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-slate-900">
                              {workflow.lastRun}
                            </p>
                            <p className="text-xs text-slate-500">Last Run</p>
                          </div>
                        </div>
                      </CardContent>

                      <CardFooter className="flex gap-2 pt-0">
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleRunWorkflow(workflow.id)}
                          disabled={workflow.status === 'error'}
                        >
                          <Play className="mr-1 h-3 w-3" />
                          Run Now
                        </Button>
                        <Button
                          variant={workflow.status === 'active' ? 'outline' : 'secondary'}
                          size="sm"
                          onClick={() => handleToggleStatus(workflow.id)}
                          disabled={workflow.status === 'draft' || workflow.status === 'error'}
                        >
                          {workflow.status === 'active' ? (
                            <Pause className="h-3 w-3" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDuplicateWorkflow(workflow)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => handleDeleteWorkflow(workflow.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Recent Runs Tab */
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-slate-600" />
                Recent Workflow Runs
              </CardTitle>
              <CardDescription>
                View the status and history of your workflow executions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockRuns.map((run) => {
                  const workflow = workflows.find((w) => w.id === run.workflowId);
                  return (
                    <div
                      key={run.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 p-4 hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full ${
                            run.status === 'success'
                              ? 'bg-green-100'
                              : run.status === 'failed'
                              ? 'bg-red-100'
                              : 'bg-blue-100'
                          }`}
                        >
                          {run.status === 'success' ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : run.status === 'failed' ? (
                            <AlertCircle className="h-5 w-5 text-red-600" />
                          ) : (
                            <Activity className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {workflow?.name || 'Unknown Workflow'}
                          </p>
                          <p className="text-sm text-slate-500">
                            {run.trigger} • {run.startedAt}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${getRunStatusColor(run.status)}`}>
                          {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                        </p>
                        <p className="text-sm text-slate-500">{run.duration}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Workflow Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-lg">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-cyan-600" />
                  <CardTitle>Create New Workflow</CardTitle>
                </div>
                <CardDescription>
                  Set up a new automated workflow to streamline your processes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateWorkflow} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Workflow Name</Label>
                    <Input
                      id="name"
                      value={createForm.name}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, name: e.target.value })
                      }
                      placeholder="e.g., Customer Onboarding"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <textarea
                      id="description"
                      value={createForm.description}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, description: e.target.value })
                      }
                      placeholder="Describe what this workflow does..."
                      rows={3}
                      className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trigger">Trigger Type</Label>
                    <select
                      id="trigger"
                      value={createForm.trigger}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          trigger: e.target.value as WorkflowItem['trigger'],
                        })
                      }
                      className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                    >
                      <option value="manual">Manual - Run manually</option>
                      <option value="scheduled">Scheduled - Run on a schedule</option>
                      <option value="webhook">Webhook - Triggered by external events</option>
                      <option value="event">Event - React to platform events</option>
                    </select>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsCreateModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1">
                      Create Workflow
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
