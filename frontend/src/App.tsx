import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { MatrixProvider } from "./contexts/MatrixContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Tasks from "./pages/Tasks";
import Community from "./pages/Community";
import AiResources from './pages/AiResources';
import ServiceCenter from "./pages/ServiceCenter";
import MyAgents from "./pages/MyAgents";
import MyWorkflows from "./pages/MyWorkflows";
import PointsMall from "./pages/PointsMall";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import MyOPC from "./pages/MyOPC";
import OPCWorkbench from "./pages/OPCWorkbench";
import OPCChannel from "./pages/OPCChannel";
import AiBit from './pages/AiBit';
import BitePlaza from './pages/BitePlaza';
import CreateEvent from './pages/CreateEvent';
import EventDetail from './pages/EventDetail';
import EventShare from './pages/EventShare';
import PostDetail from './pages/PostDetail';
import CreatePost from './pages/CreatePost';
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import UserManagement from "./pages/admin/UserManagement";
import ContentReview from "./pages/admin/ContentReview";
import TaskManagement from "./pages/admin/TaskManagement";
import OrderManagement from "./pages/admin/OrderManagement";
import AgentSettings from "./pages/admin/AgentSettings";
import OPCManagement from "./pages/admin/OPCManagement";
import AIModelGateway from "./pages/admin/AIModelGateway";
import AdminBilling from "./pages/admin/AdminBilling";
import AgentBaba from "./pages/agentbaba";
import CreateAgentPage from "./pages/agentbaba/CreateAgent";
import ClarificationPage from "./pages/agentbaba/Clarification";
import SkillMatchPage from "./pages/agentbaba/SkillMatch";
import ConfigPreviewPage from "./pages/agentbaba/ConfigPreview";
import BuildProgressPage from "./pages/agentbaba/BuildProgress";
import AgentChatPage from "./pages/agentbaba/AgentChat";
import EditAgentPage from "./pages/agentbaba/EditAgent";
import CreditHistoryPage from "./pages/credit/CreditHistory";
import CreditRechargePage from "./pages/admin/CreditRecharge";
import PointsAllocationPage from "./pages/admin/PointsAllocation";
import PointsOrders from "./pages/PointsOrders";
import ContractDetail from './pages/ContractDetail';

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Routes without Layout - Auth pages & Fullscreen pages */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/opc-workbench" element={<MatrixProvider><OPCWorkbench /></MatrixProvider>} />
            <Route path="/opc-channel" element={<MatrixProvider><OPCChannel /></MatrixProvider>} />
            {/* Event share page - fullscreen, no layout */}
            <Route path="/event/share/:code" element={<EventShare />} />

            {/* Admin routes - Fullscreen with own layout */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
			  <Route path="users" element={<UserManagement />} />
			  <Route path="review" element={<ContentReview />} />
			  <Route path="tasks" element={<TaskManagement />} />
				<Route path="orders" element={<OrderManagement />} />
				<Route path="agents" element={<AgentSettings />} />
			  <Route path="opc" element={<OPCManagement />} />
			  <Route path="api-gateway" element={<AIModelGateway />} />
<Route path="credit-recharge" element={<CreditRechargePage />} />
				  <Route path="points/allocation" element={<PointsAllocationPage />} />
<Route path="billing" element={<AdminBilling />} />
			</Route>
            {/* Routes with Layout */}
            <Route element={<Layout />}>
              {/* Public pages */}
              <Route path="/" element={<Home />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/community" element={<Community />} />
              <Route path="/ai-resources" element={<AiResources />} />
              <Route path="/service-center" element={<ServiceCenter />} />
              <Route path="/aibit" element={<AiBit />} />
              <Route path="/bite-plaza" element={<MatrixProvider><BitePlaza /></MatrixProvider>} />
              <Route path="/event/:id" element={<EventDetail />} />
              <Route path="/contracts/:id" element={<ContractDetail />} />
              <Route path="/post/:id" element={<PostDetail />} />
              <Route path="/agentbaba" element={<AgentBaba />} />
              <Route path="/agentbaba/create" element={<CreateAgentPage />} />
<Route path="/agentbaba/:sessionId/edit" element={<EditAgentPage />} />
              <Route path="/agentbaba/:sessionId" element={<ClarificationPage />} />
              <Route path="/agentbaba/:sessionId/skills" element={<SkillMatchPage />} />
              <Route path="/agentbaba/:sessionId/config" element={<ConfigPreviewPage />} />
              <Route path="/agentbaba/:sessionId/build" element={<BuildProgressPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/my-opc" element={<MyOPC />} />
                <Route path="/my-agents" element={<MyAgents />} />
                <Route path="/my-workflows" element={<MyWorkflows />} />
                <Route path="/points-mall" element={<PointsMall />} />
                <Route path="/event/create" element={<CreateEvent />} />
                <Route path="/post/create" element={<CreatePost />} />
                <Route path="/agent/chat/:id" element={<AgentChatPage />} />
                <Route path="/credit/history" element={<CreditHistoryPage />} />
                <Route path="/points/orders" element={<PointsOrders />} />
            </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
