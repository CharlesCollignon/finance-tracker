import { Component, type ErrorInfo, type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Preview/release APKs hide the redbox. Surface JS crashes so we can
 * read them on device instead of an instant close.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Root error boundary", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    const message = this.state.error.stack ?? this.state.error.message;

    return (
      <View style={{ flex: 1, backgroundColor: "#111", padding: 16, paddingTop: 64 }}>
        <Text style={{ marginBottom: 12, fontSize: 18, fontWeight: "700", color: "#f87171" }}>
          App failed to start
        </Text>
        <ScrollView>
          <Text selectable style={{ fontFamily: "monospace", fontSize: 12, color: "#fafafa" }}>
            {message}
          </Text>
        </ScrollView>
      </View>
    );
  }
}
