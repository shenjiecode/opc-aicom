import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
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
import AiBit from './pages/AiBit';
import CreateEvent from './pages/CreateEvent';
import EventDetail from './pages/EventDetail';
import EventShare from './pages/EventShare';

import MyEvents from './pages/MyEvents';

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Routes without Layout - Auth pages & Fullscreen pages */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/opc-workbench" element={<OPCWorkbench />} />
            {/* Event share page - fullscreen, no layout */}
            <Route path="/event/share/:code" element={<EventShare />} />

            {/* Routes with Layout */}
            <Route element={<Layout />}>
              {/* Public pages */}
              <Route path="/" element={<Home />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/community" element={<Community />} />
              <Route path="/ai-resources" element={<AiResources />} />
              <Route path="/service-center" element={<ServiceCenter />} />
              <Route path="/aibit" element={<AiBit />} />
              <Route path="/event/:id" element={<EventDetail />} />

              {/* Protected pages - require authentication */}
              <Route element={<ProtectedRoute />}>
                <Route path="/my-opc" element={<MyOPC />} />
                <Route path="/my-agents" element={<MyAgents />} />
                <Route path="/my-workflows" element={<MyWorkflows />} />
                <Route path="/points-mall" element={<PointsMall />} />
                <Route path="/my-events" element={<MyEvents />} />
                <Route path="/event/create" element={<CreateEvent />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
