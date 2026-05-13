import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Filter,
  DollarSign,
  Clock,
  Briefcase,
  BarChart3,
  CheckCircle,
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  budget: number;
  type: 'design' | 'dev' | 'write';
  level: 'easy' | 'medium' | 'hard';
  status: 'open' | 'in_progress' | 'completed';
  deadline: string;
  createdBy: string;
}

interface TaskFilters {
  type: string;
  level: string;
  status: string;
}

interface CreateTaskData {
  title: string;
  description: string;
  budget: number;
  type: 'design' | 'dev' | 'write';
  level: 'easy' | 'medium' | 'hard';
  deadline: string;
}

const API_BASE = '/api';

const typeOptions = [
  { value: '', label: 'All Types' },
  { value: 'design', label: 'Design' },
  { value: 'dev', label: 'Development' },
  { value: 'write', label: 'Writing' },
];

const levelOptions = [
  { value: '', label: 'All Levels' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const typeColors: Record<string, string> = {
  design: 'bg-purple-100 text-purple-700 border-purple-200',
  dev: 'bg-blue-100 text-blue-700 border-blue-200',
  write: 'bg-green-100 text-green-700 border-green-200',
};

const levelColors: Record<string, string> = {
  easy: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  hard: 'bg-red-100 text-red-700 border-red-200',
};

const statusColors: Record<string, string> = {
  open: 'bg-emerald-100 text-emerald-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-slate-100 text-slate-700',
};

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<TaskFilters>({
    type: '',
    level: '',
    status: '',
  });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTaskData>({
    title: '',
    description: '',
    budget: 0,
    type: 'dev',
    level: 'medium',
    deadline: '',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [applyingTaskId, setApplyingTaskId] = useState<string | null>(null);

  const token = localStorage.getItem('token');
  const isAuthenticated = !!token;

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [tasks, filters]);

  const fetchTasks = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/task/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      const result = await response.json();
      const data = result.data;
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      setTasks(data.tasks || []);
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...tasks];

    if (filters.type) {
      result = result.filter((task) => task.type === filters.type);
    }
    if (filters.level) {
      result = result.filter((task) => task.level === filters.level);
    }
    if (filters.status) {
      result = result.filter((task) => task.status === filters.status);
    }

    setFilteredTasks(result);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/task/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createForm),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to create task');
      }

      setIsCreateDialogOpen(false);
      setCreateForm({
        title: '',
        description: '',
        budget: 0,
        type: 'dev',
        level: 'medium',
        deadline: '',
      });
      fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsCreating(false);
    }
  };

  const handleApply = async (taskId: string) => {
    setApplyingTaskId(taskId);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/task/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ taskId }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to apply for task');
      }

      // Refresh tasks to show updated status
      fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply for task');
    } finally {
      setApplyingTaskId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isTaskApplicable = (task: Task) => {
    return task.status === 'open' && isAuthenticated;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Tasks</h1>
            <p className="text-slate-600">
              Browse and apply for available tasks in the community
            </p>
          </div>
          {isAuthenticated && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Post Task
            </Button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
            <CardDescription>Filter tasks by type, level, or status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type-filter">Type</Label>
                <select
                  id="type-filter"
                  value={filters.type}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, type: e.target.value }))
                  }
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                >
                  {typeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="level-filter">Level</Label>
                <select
                  id="level-filter"
                  value={filters.level}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, level: e.target.value }))
                  }
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                >
                  {levelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status-filter">Status</Label>
                <select
                  id="status-filter"
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-500">Loading tasks...</div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No tasks found</h3>
            <p className="text-slate-500">
              {tasks.length === 0
                ? 'Be the first to post a task!'
                : 'Try adjusting your filters to see more results.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTasks.map((task) => (
              <Card key={task.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <CardTitle className="text-lg leading-tight">{task.title}</CardTitle>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusColors[task.status]}`}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs border ${typeColors[task.type]}`}
                    >
                      {task.type}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs border ${levelColors[task.level]}`}
                    >
                      {task.level}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-sm text-slate-600 mb-4 line-clamp-3">
                    {task.description}
                  </p>
                  <div className="mt-auto space-y-2">
                    <div className="flex items-center text-sm text-slate-600">
                      <DollarSign className="h-4 w-4 mr-1.5 text-slate-400" />
                      <span className="font-medium">${task.budget.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center text-sm text-slate-600">
                      <Clock className="h-4 w-4 mr-1.5 text-slate-400" />
                      <span>Due {formatDate(task.deadline)}</span>
                    </div>
                    <div className="pt-3">
                      {isTaskApplicable(task) ? (
                        <Button
                          onClick={() => handleApply(task.id)}
                          disabled={applyingTaskId === task.id}
                          className="w-full"
                          variant="default"
                        >
                          {applyingTaskId === task.id ? 'Applying...' : 'Apply'}
                        </Button>
                      ) : (
                        <Button className="w-full" disabled variant="secondary">
                          {task.status === 'completed' ? (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Completed
                            </>
                          ) : task.status === 'in_progress' ? (
                            <>
                              <BarChart3 className="h-4 w-4 mr-2" />
                              In Progress
                            </>
                          ) : (
                            'Login to Apply'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Task Dialog */}
        {isCreateDialogOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-slate-900">Post New Task</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsCreateDialogOpen(false)}
                    className="h-8 w-8"
                  >
                    ×
                  </Button>
                </div>
                <form onSubmit={handleCreateTask} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={createForm.title}
                      onChange={(e) =>
                        setCreateForm((prev) => ({ ...prev, title: e.target.value }))
                      }
                      placeholder="Enter task title"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <textarea
                      id="description"
                      value={createForm.description}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Describe the task requirements"
                      rows={4}
                      className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 min-h-[100px]"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="budget">Budget ($)</Label>
                      <Input
                        id="budget"
                        type="number"
                        min="0"
                        value={createForm.budget || ''}
                        onChange={(e) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            budget: parseInt(e.target.value) || 0,
                          }))
                        }
                        placeholder="Enter budget"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deadline">Deadline</Label>
                      <Input
                        id="deadline"
                        type="date"
                        value={createForm.deadline}
                        onChange={(e) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            deadline: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Type</Label>
                      <select
                        id="type"
                        value={createForm.type}
                        onChange={(e) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            type: e.target.value as CreateTaskData['type'],
                          }))
                        }
                        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                      >
                        <option value="design">Design</option>
                        <option value="dev">Development</option>
                        <option value="write">Writing</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="level">Level</Label>
                      <select
                        id="level"
                        value={createForm.level}
                        onChange={(e) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            level: e.target.value as CreateTaskData['level'],
                          }))
                        }
                        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsCreateDialogOpen(false)}
                      disabled={isCreating}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1" disabled={isCreating}>
                      {isCreating ? 'Creating...' : 'Create Task'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
