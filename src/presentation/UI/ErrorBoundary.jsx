import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("UI render failed:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="app-error" role="alert">
        <section className="app-error-panel">
          <p className="app-error-kicker">Lỗi giao diện</p>
          <h1>Không thể hiển thị màn hình hiện tại</h1>
          <p>
            Ứng dụng gặp lỗi khi render. Bạn có thể tải lại trang, hoặc gửi nội dung lỗi trong console cho nhóm phát triển.
          </p>
          {this.state.error?.message && (
            <pre className="app-error-detail">{this.state.error.message}</pre>
          )}
          <button type="button" className="user-btn" onClick={this.handleReload}>
            Tải lại trang
          </button>
        </section>
      </main>
    );
  }
}
