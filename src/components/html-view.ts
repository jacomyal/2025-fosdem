import { BaseProps } from "../core/types.ts";

export abstract class HTMLView<Props extends BaseProps = BaseProps> extends HTMLElement {
  protected props: Props;
  constructor(props: Props) {
    super();
    this.props = props;
  }

  abstract init(): void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class _HTMLView extends HTMLView {
  init() {}
}
export type HTMLViewType = typeof _HTMLView;
