import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Headphones,
  Search,
  MessageCircle,
  BookOpen,
  Video,
  FileQuestion,
  LifeBuoy,
  Mail,
  Phone,
  Clock,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Send,
  X,
} from "lucide-react";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

interface SupportTicket {
  id: string;
  subject: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  lastUpdate: string;
}

const mockFAQs: FAQ[] = [
  {
    id: "1",
    question: "How do I get started with OPC platform?",
    answer:
      "Getting started is easy! First, create an account by clicking the Register button. Then, complete your profile setup and explore the available tasks. You can start applying for tasks that match your skills right away.",
    category: "Getting Started",
  },
  {
    id: "2",
    question: "How does the task payment system work?",
    answer:
      "Tasks are posted with a defined budget. When you complete a task and it's approved by the poster, the payment is processed through our secure payment system. Funds are transferred to your account within 3-5 business days.",
    category: "Payments",
  },
  {
    id: "3",
    question: "What types of tasks can I find on the platform?",
    answer:
      "Our platform features a wide variety of tasks including design work, software development, content writing, data analysis, AI model training, and more. Use the filters to find tasks that match your expertise.",
    category: "Tasks",
  },
  {
    id: "4",
    question: "How do I create my own AI agent?",
    answer:
      'Navigate to "My Agents" section and click "Create New Agent". You can choose from templates or start from scratch. Configure your agent\'s capabilities, connect APIs, and train it with your data.',
    category: "AI Features",
  },
  {
    id: "5",
    question: "Is there a mobile app available?",
    answer:
      "Yes! We offer mobile apps for both iOS and Android. Download them from the App Store or Google Play Store to manage your tasks and agents on the go.",
    category: "Platform",
  },
  {
    id: "6",
    question: "How can I earn points in the Points Mall?",
    answer:
      "You earn points by completing tasks, participating in community discussions, referring new users, and achieving milestones. Points can be redeemed for rewards in the Points Mall.",
    category: "Points & Rewards",
  },
];

const mockTickets: SupportTicket[] = [
  {
    id: "T-1001",
    subject: "Payment not received for completed task",
    status: "in_progress",
    createdAt: "2024-01-15",
    lastUpdate: "2024-01-16",
  },
  {
    id: "T-1002",
    subject: "Cannot connect AI agent to external API",
    status: "resolved",
    createdAt: "2024-01-10",
    lastUpdate: "2024-01-12",
  },
];

const supportChannels = [
  {
    icon: MessageCircle,
    title: "Live Chat",
    description: "Chat with our support team in real-time",
    availability: "24/7",
    action: "Start Chat",
  },
  {
    icon: Mail,
    title: "Email Support",
    description: "Send us an email for detailed inquiries",
    availability: "Response within 24h",
    action: "Send Email",
  },
  {
    icon: Phone,
    title: "Phone Support",
    description: "Call us for urgent matters",
    availability: "Mon-Fri 9AM-6PM",
    action: "Call Now",
  },
];

const resources = [
  {
    icon: BookOpen,
    title: "Documentation",
    description: "Comprehensive guides and API references",
    link: "#",
  },
  {
    icon: Video,
    title: "Video Tutorials",
    description: "Step-by-step video guides for beginners",
    link: "#",
  },
  {
    icon: FileQuestion,
    title: "API Reference",
    description: "Detailed API documentation for developers",
    link: "#",
  },
];

export default function ServiceCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"faq" | "contact" | "tickets">(
    "faq",
  );
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [tickets] = useState<SupportTicket[]>(mockTickets);

  const filteredFAQs = mockFAQs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.category.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const categorizedFAQs = filteredFAQs.reduce(
    (acc, faq) => {
      if (!acc[faq.category]) acc[faq.category] = [];
      acc[faq.category].push(faq);
      return acc;
    },
    {} as Record<string, FAQ[]>,
  );

  const handleContactSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    alert("Support ticket submitted! We'll get back to you soon.");
    setIsContactModalOpen(false);
    setContactForm({ name: "", email: "", subject: "", message: "" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-100 text-blue-700";
      case "in_progress":
        return "bg-amber-100 text-amber-700";
      case "resolved":
        return "bg-emerald-100 text-emerald-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
            <Headphones className="h-8 w-8" />
          </div>
          <h1 className="mb-4 text-3xl font-bold text-slate-900 md:text-4xl">
            How can we help you?
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            Find answers, get support, and connect with our team
          </p>
        </div>

        {/* Search Bar */}
        <div className="mx-auto mb-10 max-w-2xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search for answers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-14 rounded-xl border-slate-200 pl-12 text-lg shadow-sm"
            />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { icon: CheckCircle, label: "Issues Resolved", value: "98%" },
            { icon: Clock, label: "Avg Response Time", value: "< 2h" },
            { icon: LifeBuoy, label: "Support Articles", value: "150+" },
          ].map((stat) => (
            <Card key={stat.label} className="border-slate-200">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                  <stat.icon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">
                    {stat.value}
                  </div>
                  <div className="text-sm text-slate-500">{stat.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 flex justify-center gap-2">
          {[
            { id: "faq", label: "FAQ", icon: FileQuestion },
            { id: "contact", label: "Contact Us", icon: MessageCircle },
            { id: "tickets", label: "My Tickets", icon: Mail },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "outline"}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className="gap-2"
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Button>
          ))}
        </div>

        {/* FAQ Tab */}
        {activeTab === "faq" && (
          <div className="space-y-8">
            {Object.entries(categorizedFAQs).length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="py-12 text-center">
                  <Search className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                  <h3 className="mb-2 text-lg font-medium text-slate-900">
                    No results found
                  </h3>
                  <p className="text-slate-500">
                    Try searching with different keywords
                  </p>
                </CardContent>
              </Card>
            ) : (
              Object.entries(categorizedFAQs).map(([category, faqs]) => (
                <div key={category}>
                  <h2 className="mb-4 text-xl font-semibold text-slate-900">
                    {category}
                  </h2>
                  <div className="space-y-3">
                    {faqs.map((faq) => (
                      <Card
                        key={faq.id}
                        className="cursor-pointer border-slate-200 transition-shadow hover:shadow-md"
                        onClick={() =>
                          setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)
                        }
                      >
                        <CardHeader className="py-4">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-medium">
                              {faq.question}
                            </CardTitle>
                            {expandedFAQ === faq.id ? (
                              <ChevronUp className="h-5 w-5 text-slate-400" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                        </CardHeader>
                        {expandedFAQ === faq.id && (
                          <CardContent className="pt-0 pb-4">
                            <div className="border-t border-slate-100 pt-4 text-slate-600">
                              {faq.answer}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              ))
            )}

            {/* Resources Section */}
            <div className="mt-10">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
                Helpful Resources
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {resources.map((resource) => (
                  <Card
                    key={resource.title}
                    className="group cursor-pointer border-slate-200 transition-all hover:border-blue-300 hover:shadow-md"
                  >
                    <CardContent className="p-6">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 group-hover:bg-blue-100">
                        <resource.icon className="h-5 w-5 text-slate-600 group-hover:text-blue-600" />
                      </div>
                      <h3 className="mb-1 font-medium text-slate-900">
                        {resource.title}
                      </h3>
                      <p className="mb-3 text-sm text-slate-500">
                        {resource.description}
                      </p>
                      <div className="flex items-center text-sm text-blue-600">
                        Learn more
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Contact Tab */}
        {activeTab === "contact" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {supportChannels.map((channel) => (
              <Card key={channel.title} className="border-slate-200">
                <CardHeader>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                    <channel.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg">{channel.title}</CardTitle>
                  <CardDescription>{channel.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex items-center gap-2 text-sm text-slate-600">
                    <Clock className="h-4 w-4" />
                    <span>{channel.availability}</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => {
                      if (channel.title === "Email Support") {
                        setIsContactModalOpen(true);
                      }
                    }}
                  >
                    {channel.action}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Tickets Tab */}
        {activeTab === "tickets" && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                My Support Tickets
              </h2>
              <Button onClick={() => setIsContactModalOpen(true)}>
                <Mail className="mr-2 h-4 w-4" />
                New Ticket
              </Button>
            </div>
            {tickets.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="py-12 text-center">
                  <Mail className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                  <h3 className="mb-2 text-lg font-medium text-slate-900">
                    No tickets yet
                  </h3>
                  <p className="text-slate-500 mb-4">
                    Create a new support ticket if you need help
                  </p>
                  <Button onClick={() => setIsContactModalOpen(true)}>
                    Create Ticket
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {tickets.map((ticket) => (
                  <Card key={ticket.id} className="border-slate-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-sm font-medium text-slate-500">
                              {ticket.id}
                            </span>
                            <Badge className={getStatusColor(ticket.status)}>
                              {ticket.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <h3 className="font-medium text-slate-900">
                            {ticket.subject}
                          </h3>
                          <div className="mt-1 text-sm text-slate-500">
                            Created: {ticket.createdAt} • Last update:{" "}
                            {ticket.lastUpdate}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contact Modal */}
        {isContactModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-blue-600" />
                    <CardTitle>Contact Support</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsContactModalOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription>
                  Fill out the form below and we'll get back to you as soon as
                  possible
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={contactForm.name}
                        onChange={(e) =>
                          setContactForm({
                            ...contactForm,
                            name: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={contactForm.email}
                        onChange={(e) =>
                          setContactForm({
                            ...contactForm,
                            email: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={contactForm.subject}
                      onChange={(e) =>
                        setContactForm({
                          ...contactForm,
                          subject: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <textarea
                      id="message"
                      value={contactForm.message}
                      onChange={(e) =>
                        setContactForm({
                          ...contactForm,
                          message: e.target.value,
                        })
                      }
                      rows={4}
                      className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                      required
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsContactModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1">
                      <Send className="mr-2 h-4 w-4" />
                      Send Message
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
