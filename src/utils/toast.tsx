import { toast as notify, type ExternalToast } from "sonner";
export type ToastOptions = ExternalToast;
const options = (description?: string, extra?: ToastOptions) => ({
  description,
  duration: 2500,
  ...extra,
});
const toast = {
  default: (title: string, description?: string, extra?: ToastOptions) =>
    notify(title, options(description, extra)),
  primary: (title: string, description?: string, extra?: ToastOptions) =>
    notify(title, options(description, extra)),
  secondary: (title: string, description?: string, extra?: ToastOptions) =>
    notify(title, options(description, extra)),
  success: (title: string, description?: string, extra?: ToastOptions) =>
    notify.success(title, options(description, extra)),
  warning: (title: string, description?: string, extra?: ToastOptions) =>
    notify.warning(title, options(description, extra)),
  error: (title: string, description?: string, extra?: ToastOptions) =>
    notify.error(title, options(description, extra)),
};
export default toast;
