import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import {
  User,
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
  Shield,
  Upload,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type VerificationType = "personal" | "enterprise";
type SubmitStatus = "idle" | "loading" | "success" | "error";

interface VerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PersonalFormData {
  realName: string;
  idCardNumber: string;
  phoneNumber: string;
}

interface EnterpriseFormData {
  enterpriseName: string;
  businessLicenseNumber: string;
  legalRepresentative: string;
  contactPhone: string;
}

interface VerificationStatusInfo {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: React.ReactNode;
  description: string;
}

const getVerificationStatusInfo = (
  status: string,
  type: string
): VerificationStatusInfo => {
  switch (status) {
    case "verified":
      return {
        label: "已认证",
        variant: "default",
        icon: <CheckCircle2 className="w-4 h-4" />,
        description:
          type === "enterprise"
            ? "您的企业认证已通过"
            : "您的个人实名认证已通过",
      };
    case "pending":
      return {
        label: "审核中",
        variant: "secondary",
        icon: <Clock className="w-4 h-4" />,
        description: "您的认证申请正在审核中，请耐心等待",
      };
    case "rejected":
      return {
        label: "已拒绝",
        variant: "destructive",
        icon: <XCircle className="w-4 h-4" />,
        description: "您的认证申请未通过，请修改后重新提交",
      };
    default:
      return {
        label: "未认证",
        variant: "outline",
        icon: <Shield className="w-4 h-4" />,
        description: "完成认证以解锁更多功能",
      };
  }
};

export function VerificationDialog({
  open,
  onOpenChange,
}: VerificationDialogProps) {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<VerificationType>("personal");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string>("");

  // Personal form state
  const [personalForm, setPersonalForm] = useState<PersonalFormData>({
    realName: "",
    idCardNumber: "",
    phoneNumber: "",
  });
  const [personalErrors, setPersonalErrors] = useState<Partial<PersonalFormData>>({});

  // Enterprise form state
  const [enterpriseForm, setEnterpriseForm] = useState<EnterpriseFormData>({
    enterpriseName: "",
    businessLicenseNumber: "",
    legalRepresentative: "",
    contactPhone: "",
  });
  const [enterpriseErrors, setEnterpriseErrors] = useState<Partial<EnterpriseFormData>>({});

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSubmitStatus("idle");
      setSubmitError("");
      setPersonalErrors({});
      setEnterpriseErrors({});

      // Set initial tab based on user's current member type
      if (user?.memberType === "enterprise") {
        setActiveTab("enterprise");
      } else {
        setActiveTab("personal");
      }

      // Pre-fill personal form if user has realName
      if (user?.realName) {
        setPersonalForm((prev) => ({
          ...prev,
          realName: user.realName || "",
        }));
      }

      // Pre-fill enterprise form if user has enterpriseName
      if (user?.enterpriseName) {
        setEnterpriseForm((prev) => ({
          ...prev,
          enterpriseName: user.enterpriseName || "",
        }));
      }
    }
  }, [open, user]);

  const validatePersonalForm = (): boolean => {
    const errors: Partial<PersonalFormData> = {};

    if (!personalForm.realName.trim()) {
      errors.realName = "请输入真实姓名";
    } else if (personalForm.realName.length < 2) {
      errors.realName = "姓名至少需要2个字符";
    }

    if (!personalForm.idCardNumber.trim()) {
      errors.idCardNumber = "请输入身份证号";
    } else if (!/^\d{17}[\dX]$/.test(personalForm.idCardNumber)) {
      errors.idCardNumber = "请输入有效的18位身份证号";
    }

    if (!personalForm.phoneNumber.trim()) {
      errors.phoneNumber = "请输入手机号码";
    } else if (!/^1[3-9]\d{9}$/.test(personalForm.phoneNumber)) {
      errors.phoneNumber = "请输入有效的11位手机号";
    }

    setPersonalErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateEnterpriseForm = (): boolean => {
    const errors: Partial<EnterpriseFormData> = {};

    if (!enterpriseForm.enterpriseName.trim()) {
      errors.enterpriseName = "请输入企业全称";
    } else if (enterpriseForm.enterpriseName.length < 4) {
      errors.enterpriseName = "企业名称至少需要4个字符";
    }

    if (!enterpriseForm.businessLicenseNumber.trim()) {
      errors.businessLicenseNumber = "请输入统一社会信用代码";
    } else if (!/^[A-Z0-9]{18}$/.test(enterpriseForm.businessLicenseNumber)) {
      errors.businessLicenseNumber = "请输入有效的18位统一社会信用代码";
    }

    if (!enterpriseForm.legalRepresentative.trim()) {
      errors.legalRepresentative = "请输入法定代表人姓名";
    } else if (enterpriseForm.legalRepresentative.length < 2) {
      errors.legalRepresentative = "姓名至少需要2个字符";
    }

    if (!enterpriseForm.contactPhone.trim()) {
      errors.contactPhone = "请输入联系电话";
    } else if (!/^1[3-9]\d{9}$/.test(enterpriseForm.contactPhone)) {
      errors.contactPhone = "请输入有效的11位手机号";
    }

    setEnterpriseErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitPersonal = async () => {
    if (!validatePersonalForm()) return;

    setSubmitStatus("loading");
    setSubmitError("");

    try {
      // Map frontend fields to backend
      const backendData = {
        realName: personalForm.realName,
        idCardNumber: personalForm.idCardNumber,
      };
      const response = await fetch("/api/verification/personal", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(backendData),
      });

      const data = await response.json();

      if (!response.ok || data.code !== 0) {
        throw new Error(data.message || "提交失败，请重试");
      }

      setSubmitStatus("success");
      await refreshUser();
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (error) {
      setSubmitStatus("error");
      setSubmitError(error instanceof Error ? error.message : "提交失败，请重试");
    }
  };

  const handleSubmitEnterprise = async () => {
    if (!validateEnterpriseForm()) return;

    setSubmitStatus("loading");
    setSubmitError("");

    try {
      // Map frontend fields to backend fields
      const backendData = {
        enterpriseName: enterpriseForm.enterpriseName,
        licenseNumber: enterpriseForm.businessLicenseNumber,
        legalPersonName: enterpriseForm.legalRepresentative,
        unifiedSocialCode: enterpriseForm.businessLicenseNumber,
      };
      const response = await fetch("/api/verification/enterprise", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(backendData),
      });

      const data = await response.json();

      if (!response.ok || data.code !== 0) {
        throw new Error(data.message || "提交失败，请重试");
      }

      setSubmitStatus("success");
      await refreshUser();
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (error) {
      setSubmitStatus("error");
      setSubmitError(error instanceof Error ? error.message : "提交失败，请重试");
    }
  };

  const verificationInfo = getVerificationStatusInfo(
    user?.verificationStatus || "none",
    user?.memberType || "normal"
  );

  const isVerified = user?.verificationStatus === "verified";
  const isPending = user?.verificationStatus === "pending";
  const isRejected = user?.verificationStatus === "rejected";

  // Don't allow form editing if already verified or pending
  const canEditForm = !isVerified && !isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] bg-[var(--bg-elevated)] border-[var(--border-default)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--primary-500)] to-purple-500 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl text-[var(--text-primary)]">
                实名认证
              </DialogTitle>
              <DialogDescription className="text-[var(--text-secondary)]">
                完成认证以解锁更多平台功能
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Current Status Card */}
        <div className="mt-4 p-4 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-default)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge
                variant={verificationInfo.variant}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5",
                  user?.verificationStatus === "verified" &&
                    "bg-[var(--primary-500)]/20 text-[var(--primary-500)] border-[var(--primary-500)]/30"
                )}
              >
                {verificationInfo.icon}
                <span>{verificationInfo.label}</span>
              </Badge>
              <span className="text-sm text-[var(--text-secondary)]">
                {user?.memberType === "enterprise"
                  ? "企业认证"
                  : user?.memberType === "personal"
                  ? "个人认证"
                  : "未选择认证类型"}
              </span>
            </div>
          </div>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {verificationInfo.description}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="mt-6 flex p-1 bg-[var(--bg-muted)] rounded-xl">
          <button
            onClick={() => setActiveTab("personal")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200",
              activeTab === "personal"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
            disabled={isVerified && user?.memberType === "enterprise"}
          >
            <User className="w-4 h-4" />
            个人实名认证
          </button>
          <button
            onClick={() => setActiveTab("enterprise")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200",
              activeTab === "enterprise"
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
            disabled={isVerified && user?.memberType === "personal"}
          >
            <Building2 className="w-4 h-4" />
            企业认证
          </button>
        </div>

        {/* Success State */}
        {submitStatus === "success" && (
          <div className="mt-6 p-6 rounded-xl bg-green-500/10 border border-green-500/30 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-green-500 mb-1">
              提交成功
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              您的认证申请已提交，我们将尽快进行审核
            </p>
          </div>
        )}

        {/* Already Verified State */}
        {submitStatus !== "success" && isVerified && (
          <div className="mt-6 p-6 rounded-xl bg-[var(--primary-500)]/10 border border-[var(--primary-500)]/30 text-center">
            <CheckCircle2 className="w-12 h-12 text-[var(--primary-500)] mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-[var(--primary-500)] mb-1">
              您已完成认证
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              {activeTab === "enterprise"
                ? `企业名称：${user?.enterpriseName || "未设置"}`
                : `真实姓名：${user?.realName || "未设置"}`}
            </p>
          </div>
        )}

        {/* Pending State */}
        {submitStatus !== "success" && isPending && (
          <div className="mt-6 p-6 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
            <Clock className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-amber-500 mb-1">
              审核中
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              您的认证申请正在审核中，请耐心等待
            </p>
          </div>
        )}

        {/* Rejected State with Retry */}
        {submitStatus !== "success" && isRejected && (
          <div className="mt-6 p-6 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-red-500 mb-1">
              认证被拒绝
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              您的认证申请未通过审核，请检查信息后重新提交
            </p>
          </div>
        )}

        {/* Personal Form */}
        {submitStatus !== "success" && canEditForm && activeTab === "personal" && (
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="realName"
                className="text-[var(--text-primary)] flex items-center gap-1"
              >
                真实姓名
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="realName"
                placeholder="请输入真实姓名"
                value={personalForm.realName}
                onChange={(e) =>
                  setPersonalForm((prev) => ({
                    ...prev,
                    realName: e.target.value,
                  }))
                }
                className={cn(
                  "bg-[var(--bg-muted)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                  personalErrors.realName && "border-red-500 focus-visible:ring-red-500"
                )}
              />
              {personalErrors.realName && (
                <p className="text-xs text-red-500">{personalErrors.realName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="idCardNumber"
                className="text-[var(--text-primary)] flex items-center gap-1"
              >
                身份证号
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="idCardNumber"
                placeholder="请输入18位身份证号码"
                value={personalForm.idCardNumber}
                onChange={(e) =>
                  setPersonalForm((prev) => ({
                    ...prev,
                    idCardNumber: e.target.value.toUpperCase(),
                  }))
                }
                maxLength={18}
                className={cn(
                  "bg-[var(--bg-muted)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                  personalErrors.idCardNumber && "border-red-500 focus-visible:ring-red-500"
                )}
              />
              {personalErrors.idCardNumber && (
                <p className="text-xs text-red-500">
                  {personalErrors.idCardNumber}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="phoneNumber"
                className="text-[var(--text-primary)] flex items-center gap-1"
              >
                手机号码
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="请输入11位手机号码"
                value={personalForm.phoneNumber}
                onChange={(e) =>
                  setPersonalForm((prev) => ({
                    ...prev,
                    phoneNumber: e.target.value,
                  }))
                }
                maxLength={11}
                className={cn(
                  "bg-[var(--bg-muted)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                  personalErrors.phoneNumber && "border-red-500 focus-visible:ring-red-500"
                )}
              />
              {personalErrors.phoneNumber && (
                <p className="text-xs text-red-500">
                  {personalErrors.phoneNumber}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--text-primary)] flex items-center gap-1">
                身份证正面照片
                <span className="text-red-500">*</span>
              </Label>
              <div className="border-2 border-dashed border-[var(--border-default)] rounded-xl p-8 text-center hover:border-[var(--primary-500)]/50 transition-colors cursor-pointer">
                <Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--text-secondary)]">
                  点击上传身份证正面照片
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  支持 JPG、PNG 格式，大小不超过 5MB
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Enterprise Form */}
        {submitStatus !== "success" && canEditForm && activeTab === "enterprise" && (
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="enterpriseName"
                className="text-[var(--text-primary)] flex items-center gap-1"
              >
                企业全称
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="enterpriseName"
                placeholder="请输入企业全称"
                value={enterpriseForm.enterpriseName}
                onChange={(e) =>
                  setEnterpriseForm((prev) => ({
                    ...prev,
                    enterpriseName: e.target.value,
                  }))
                }
                className={cn(
                  "bg-[var(--bg-muted)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                  enterpriseErrors.enterpriseName &&
                    "border-red-500 focus-visible:ring-red-500"
                )}
              />
              {enterpriseErrors.enterpriseName && (
                <p className="text-xs text-red-500">
                  {enterpriseErrors.enterpriseName}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="businessLicenseNumber"
                className="text-[var(--text-primary)] flex items-center gap-1"
              >
                统一社会信用代码
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="businessLicenseNumber"
                placeholder="请输入18位统一社会信用代码"
                value={enterpriseForm.businessLicenseNumber}
                onChange={(e) =>
                  setEnterpriseForm((prev) => ({
                    ...prev,
                    businessLicenseNumber: e.target.value.toUpperCase(),
                  }))
                }
                maxLength={18}
                className={cn(
                  "bg-[var(--bg-muted)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                  enterpriseErrors.businessLicenseNumber &&
                    "border-red-500 focus-visible:ring-red-500"
                )}
              />
              {enterpriseErrors.businessLicenseNumber && (
                <p className="text-xs text-red-500">
                  {enterpriseErrors.businessLicenseNumber}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="legalRepresentative"
                className="text-[var(--text-primary)] flex items-center gap-1"
              >
                法定代表人
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="legalRepresentative"
                placeholder="请输入法定代表人姓名"
                value={enterpriseForm.legalRepresentative}
                onChange={(e) =>
                  setEnterpriseForm((prev) => ({
                    ...prev,
                    legalRepresentative: e.target.value,
                  }))
                }
                className={cn(
                  "bg-[var(--bg-muted)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                  enterpriseErrors.legalRepresentative &&
                    "border-red-500 focus-visible:ring-red-500"
                )}
              />
              {enterpriseErrors.legalRepresentative && (
                <p className="text-xs text-red-500">
                  {enterpriseErrors.legalRepresentative}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="contactPhone"
                className="text-[var(--text-primary)] flex items-center gap-1"
              >
                联系电话
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contactPhone"
                type="tel"
                placeholder="请输入11位手机号码"
                value={enterpriseForm.contactPhone}
                onChange={(e) =>
                  setEnterpriseForm((prev) => ({
                    ...prev,
                    contactPhone: e.target.value,
                  }))
                }
                maxLength={11}
                className={cn(
                  "bg-[var(--bg-muted)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                  enterpriseErrors.contactPhone &&
                    "border-red-500 focus-visible:ring-red-500"
                )}
              />
              {enterpriseErrors.contactPhone && (
                <p className="text-xs text-red-500">
                  {enterpriseErrors.contactPhone}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--text-primary)] flex items-center gap-1">
                营业执照
                <span className="text-red-500">*</span>
              </Label>
              <div className="border-2 border-dashed border-[var(--border-default)] rounded-xl p-8 text-center hover:border-[var(--primary-500)]/50 transition-colors cursor-pointer">
                <Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--text-secondary)]">
                  点击上传营业执照
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  支持 JPG、PNG、PDF 格式，大小不超过 10MB
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {submitError && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-500 text-center">{submitError}</p>
          </div>
        )}

        {/* Footer Actions */}
        <DialogFooter className="gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitStatus === "loading"}
            className="border-[var(--border-default)]"
          >
            {submitStatus === "success" ? "关闭" : "取消"}
          </Button>
          {canEditForm && submitStatus !== "success" && (
            <Button
              onClick={
                activeTab === "personal"
                  ? handleSubmitPersonal
                  : handleSubmitEnterprise
              }
              disabled={submitStatus === "loading"}
              className="bg-[var(--primary-500)] hover:bg-[var(--primary-400)]"
            >
              {submitStatus === "loading" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  提交中...
                </>
              ) : (
                "提交认证"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
