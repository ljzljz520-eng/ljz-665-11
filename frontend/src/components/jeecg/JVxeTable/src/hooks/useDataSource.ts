import { nextTick, watch } from 'vue';
import { JVxeDataProps, JVxeRefs, JVxeTableMethods } from '../types';
import { cloneDeep } from 'lodash-es';

export function useDataSource(props, data: JVxeDataProps, methods: JVxeTableMethods, refs: JVxeRefs) {
  watch(
    () => props.dataSource,
    async () => {
      data.disabledRowIds = [];
      data.vxeDataSource.value = cloneDeep(props.dataSource);
      data.vxeDataSource.value.forEach((row, rowIndex) => {
        // 判断是否是禁用行
        if (methods.isDisabledRow(row, rowIndex)) {
          data.disabledRowIds.push(row.id);
        }
        // 处理联动回显数据
        methods.handleLinkageBackData(row);
      });
      await waitRef(refs.gridRef);
      methods.recalcSortNumber();
    },
    { immediate: true }
  );
}
// update-begin--author:liaozhiyang---date:20260130---for:【QQYUN-14177】online配置界面，字段配置卡顿
function waitRef($ref, maxTries = 100) {
  return new Promise<any>((resolve) => {
    let tries = 0;
    (function next() {
      if ($ref.value) {
        resolve($ref);
      } else if (tries >= maxTries) {
        resolve(null);
      } else {
        tries++;
        nextTick(() => next());
      }
    })();
  });
}
// update-end--author:liaozhiyang---date:20260130---for:【QQYUN-14177】online配置界面，字段配置卡顿
