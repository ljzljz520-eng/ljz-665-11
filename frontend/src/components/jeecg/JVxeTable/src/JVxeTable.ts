import { defineComponent, h, nextTick, useSlots, shallowRef, markRaw } from 'vue';
import { vxeEmits, vxeProps } from './vxe.data';
import { useData, useRefs, useResolveComponent as rc } from './hooks/useData';
import { useColumns } from './hooks/useColumns';
import { useColumnsCache } from './hooks/useColumnsCache';
import { useMethods } from './hooks/useMethods';
import { useDataSource } from './hooks/useDataSource';
import { useDragSort } from './hooks/useDragSort';
import { useRenderComponents } from './hooks/useRenderComponents';
import { useFinallyProps } from './hooks/useFinallyProps';
import { JVxeTableProps } from './types';
import './style/index.less';

export default defineComponent({
  name: 'JVxeTable',
  inheritAttrs: false,
  props: vxeProps(),
  emits: [...vxeEmits],
  setup(props: JVxeTableProps, context) {
    // update-begin--author:liaozhiyang---date:20260130---for:【QQYUN-14177】online配置界面，字段配置卡顿
    // 使用 shallowRef 优化大型对象响应式性能
    const instanceRef = shallowRef();
    // update-begin--author:liaozhiyang---date:20260130---for:【QQYUN-14177】online配置界面，字段配置卡顿
    const refs = useRefs();
    const slots = useSlots();
    const data = useData(props);
    const { methods, publicMethods, created } = useMethods(props, context, data, refs, instanceRef);
    created();
    useColumns(props, data, methods, slots);
    useDataSource(props, data, methods, refs);
    useDragSort(props, methods);
    // 代码逻辑说明: 【QQYUN-8566】JVXETable无法记住列设置
    const { initSetting } = useColumnsCache({ cacheColumnsKey: props.cacheColumnsKey });
    initSetting(props);
    // 最终传入到 template 里的 props
    const finallyProps = useFinallyProps(props, data, methods);
    // 渲染子组件
    const renderComponents = useRenderComponents(props, data, methods, slots);
    // update-begin--author:liaozhiyang---date:20260130---for:【QQYUN-14177】online配置界面，字段配置卡顿
    markRaw(renderComponents);
    // update-end--author:liaozhiyang---date:20260130---for:【QQYUN-14177】online配置界面，字段配置卡顿
    return {
      instanceRef,
      ...refs,
      ...publicMethods,
      ...finallyProps,
      ...renderComponents,
      vxeDataSource: data.vxeDataSource,
    };
  },
  render() {
    return h(
      'div',
      {
        class: this.$attrs.class,
        style: this.$attrs.style,
      },
      h(
        rc('a-spin'),
        {
          spinning: this.loading,
          wrapperClassName: this.prefixCls,
        },
        {
          default: () => [
            this.renderSubPopover(),
            this.renderToolbar(),
            this.renderToolbarAfterSlot(),
            h(
              rc('vxe-grid'),
              {
                ...this.vxeProps,
                data: this.vxeDataSource,
              },
              this.$slots
            ),
            this.renderPagination(),
            this.renderDetailsModal(),
          ],
        }
      )
    );
  },
  created() {
    this.instanceRef = this;
  },
});
