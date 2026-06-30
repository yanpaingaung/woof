declare namespace React {
  namespace JSX {
    interface IntrinsicElements {
      marquee: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { scrollamount?: number },
        HTMLElement
      >;
    }
  }
}
