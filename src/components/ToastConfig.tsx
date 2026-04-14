"use client";

import { ToastContainer, toast, Slide, ToastOptions } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const baseToastStyle = {
  padding: "20px 24px",
  borderRadius: "10px",
  boxShadow: "0 4px 18px rgba(0,0,0,0.08)",
  lineHeight: "1.4",
  minHeight: "unset",
};

function buildOptions(
  background: string,
  color: string,
  border: string
): ToastOptions {
  return {
    style: {
      ...baseToastStyle,
      background,
      color,
      border,
    },
  };
}

export const notify = {
  success: (msg: string) =>
    toast.success(
      <div style={{ padding: "4px 8px 8px 8px" }}>{msg}</div>,
      buildOptions("#E8F8EF", "#1BAE69", "1px solid #1BAE69")
    ),

  warning: (msg: string) =>
    toast.warning(
      <div style={{ padding: "0 4px 4px 4px" }}>{msg}</div>,
      buildOptions("#FFF8E5", "#B68900", "1px solid #FFB400")
    ),

  error: (msg: string) =>
    toast.error(
      <div style={{ padding: "0 4px 4px 4px" }}>{msg}</div>,
      buildOptions("#FDECEC", "#D32F2F", "1px solid #D32F2F")
    ),

  info: (msg: string) =>
    toast.info(
      <div style={{ padding: "0 4px 4px 4px" }}>{msg}</div>,
      buildOptions("#EAF4FF", "#0067B8", "1px solid #0081BF")
    ),
};

<style jsx global>{`
  .Toastify__toast-body {
    margin: 0 !important;
    padding: 0 !important;
    align-items: center !important;
  }
`}</style>

export const ToastConfig = () => (
  <ToastContainer
    position="top-center"
    autoClose={3000}
    hideProgressBar={false}
    closeOnClick
    pauseOnFocusLoss
    draggable
    pauseOnHover
    transition={Slide}
    theme="light"
    toastStyle={{
      background: "#FFFFFF",
      color: "#1F2937",
      border: "1px solid #E5E5E5",
      borderRadius: "10px",
      boxShadow: "0 4px 18px rgba(0,0,0,0.08)",
    }}
    icon={({ type }) => {
      const size = 18;

      switch (type) {
        case "success":
          return (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={size}
              height={size}
              fill="none"
              viewBox="0 0 24 24"
              stroke="#1BAE69"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          );

        case "warning":
          return (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={size}
              height={size}
              fill="none"
              viewBox="0 0 24 24"
              stroke="#B68900"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v4m0 4h.01M10.29 3.86l-8.48 14.72A1 1 0 002.76 21h18.48a1 1 0 00.85-1.42L13.6 3.86a1 1 0 00-1.7 0z"
              />
            </svg>
          );

        case "error":
          return (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={size}
              height={size}
              fill="none"
              viewBox="0 0 24 24"
              stroke="#D32F2F"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          );

        case "info":
          return (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={size}
              height={size}
              fill="none"
              viewBox="0 0 24 24"
              stroke="#0067B8"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z"
              />
            </svg>
          );

        default:
          return null;
      }
    }}
    toastClassName={() => ""}
  />
);