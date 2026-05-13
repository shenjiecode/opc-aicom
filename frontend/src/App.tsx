import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Tasks from './pages/Tasks';
import Community from './pages/Community';
import AiResources from './pages/AiResources';
import ServiceCenter from './pages/ServiceCenter';
import MyAgents from './pages/MyAgents';
import MyWorkflows from './pages/MyWorkflows';
import PointsMall from './pages/PointsMall';
import { Layout } from './components/Layout';
import MyOPC from './pages/MyOPC';
import OPCWorkbench from './pages/OPCWorkbench';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Routes without Layout - Auth pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Routes with Layout */}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/community" element={<Community />} />
          <Route path="/ai-resources" element={<AiResources />} />
          <Route path="/service-center" element={<ServiceCenter />} />
          <Route path="/my-opc" element={<MyOPC />} />
          <Route path="/my-agents" element={<MyAgents />} />
          <Route path="/my-workflows" element={<MyWorkflows />} />
          <Route path="/points-mall" element={<PointsMall />} />
<Route path="/opc-workbench" element={<OPCWorkbench />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
