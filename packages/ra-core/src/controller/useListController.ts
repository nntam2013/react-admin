import { isValidElement, ReactElement, useEffect, useMemo } from 'react';
import inflection from 'inflection';
import { Location } from 'history';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import get from 'lodash/get';

import { useCheckMinimumRequiredProps } from './checkMinimumRequiredProps';
import useListParams from './useListParams';
import useRecordSelection from './useRecordSelection';
import useVersion from './useVersion';
import { useTranslate } from '../i18n';
import { SORT_ASC } from '../reducer/admin/resource/list/queryReducer';
import { CRUD_GET_LIST, ListParams } from '../actions';
import { useNotify } from '../sideEffect';
import { Sort, RecordMap, Identifier, ReduxState, Record } from '../types';
import useGetList from '../dataProvider/useGetList';

export interface ListProps {
    // the props you can change
    filter?: object;
    filters?: ReactElement<any>;
    filterDefaultValues?: object;
    pagination?: ReactElement<any>;
    perPage?: number;
    sort?: Sort;
    // the props managed by react-admin
    basePath: string;
    debounce?: number;
    hasCreate?: boolean;
    hasEdit?: boolean;
    hasList?: boolean;
    hasShow?: boolean;
    location?: Location;
    path?: string;
    query: ListParams;
    resource: string;
    [key: string]: any;
}

const defaultSort = {
    field: 'id',
    order: SORT_ASC,
};

const defaultData = {};

export interface ListControllerProps<RecordType = Record> {
    basePath: string;
    currentSort: Sort;
    data: RecordMap<RecordType>;
    defaultTitle: string;
    displayedFilters: any;
    filterValues: any;
    hasCreate: boolean;
    hideFilter: (filterName: string) => void;
    ids: Identifier[];
    loading: boolean;
    loaded: boolean;
    onSelect: (ids: Identifier[]) => void;
    onToggleItem: (id: Identifier) => void;
    onUnselectItems: () => void;
    page: number;
    perPage: number;
    resource: string;
    selectedIds: Identifier[];
    setFilters: (filters: any, displayedFilters: any) => void;
    setPage: (page: number) => void;
    setPerPage: (page: number) => void;
    setSort: (sort: string) => void;
    showFilter: (filterName: string, defaultValue: any) => void;
    total: number;
    version: number;
}

/**
 * Prepare data for the List view
 *
 * @param {Object} props The props passed to the List component.
 *
 * @return {Object} controllerProps Fetched and computed data for the List view
 *
 * @example
 *
 * import { useListController } from 'react-admin';
 * import ListView from './ListView';
 *
 * const MyList = props => {
 *     const controllerProps = useListController(props);
 *     return <ListView {...controllerProps} {...props} />;
 * }
 */
const useListController = <RecordType = Record>(
    props: ListProps
): ListControllerProps<RecordType> => {
    useCheckMinimumRequiredProps('List', ['basePath', 'resource'], props);

    const {
        basePath,
        resource,
        hasCreate,
        filterDefaultValues,
        sort = defaultSort,
        perPage = 10,
        filter,
        debounce = 500,
    } = props;

    if (filter && isValidElement(filter)) {
        throw new Error(
            '<List> received a React element as `filter` props. If you intended to set the list filter elements, use the `filters` (with an s) prop instead. The `filter` prop is internal and should not be set by the developer.'
        );
    }

    const location = useLocation();
    const translate = useTranslate();
    const notify = useNotify();
    const version = useVersion();

    const [query, queryModifiers] = useListParams({
        resource,
        location,
        filterDefaultValues,
        sort,
        perPage,
        debounce,
    });

    const [selectedIds, selectionModifiers] = useRecordSelection(resource);

    /**
     * We want the list of ids to be always available for optimistic rendering,
     * and therefore we need a custom action (CRUD_GET_LIST) that will be used.
     */
    const { ids, total, loading, loaded } = useGetList<RecordType>(
        resource,
        {
            page: query.page,
            perPage: query.perPage,
        },
        { field: query.sort, order: query.order },
        { ...query.filter, ...filter },
        {
            action: CRUD_GET_LIST,
            version,
            onFailure: error =>
                notify(
                    typeof error === 'string'
                        ? error
                        : error.message || 'ra.notification.http_error',
                    'warning'
                ),
        }
    );

    const data = useSelector(
        (state: ReduxState): RecordMap<RecordType> =>
            get(
                state.admin.resources,
                [resource, 'data'],
                defaultData
            ) as RecordMap<RecordType>
    );

    // When the user changes the page/sort/filter, this controller runs the
    // useGetList hook again. While the result of this new call is loading,
    // the ids and total are empty. To avoid rendering an empty list at that
    // moment, we override the ids and total with the latest loaded ones.
    const defaultIds = useSelector(
        (state: ReduxState): Identifier[] =>
            get(state.admin.resources, [resource, 'list', 'ids'], [])
    );
    const defaultTotal = useSelector(
        (state: ReduxState): number =>
            get(state.admin.resources, [resource, 'list', 'total'], 0)
    );

    useEffect(() => {
        if (
            query.page <= 0 ||
            (!loading && query.page > 1 && (ids || []).length === 0)
        ) {
            // query for a page that doesn't exist, set page to 1
            queryModifiers.setPage(1);
        }
    }, [loading, query.page, ids, queryModifiers]);

    const currentSort = useMemo(
        () => ({
            field: query.sort,
            order: query.order,
        }),
        [query.sort, query.order]
    );

    const resourceName = translate(`resources.${resource}.name`, {
        smart_count: 2,
        _: inflection.humanize(inflection.pluralize(resource)),
    });
    const defaultTitle = translate('ra.page.list', {
        name: resourceName,
    });

    return {
        basePath,
        currentSort,
        data,
        defaultTitle,
        displayedFilters: query.displayedFilters,
        filterValues: query.filterValues,
        hasCreate,
        hideFilter: queryModifiers.hideFilter,
        ids: typeof total === 'undefined' ? defaultIds : ids,
        loaded: loaded || defaultIds.length > 0,
        loading,
        onSelect: selectionModifiers.select,
        onToggleItem: selectionModifiers.toggle,
        onUnselectItems: selectionModifiers.clearSelection,
        page: query.page,
        perPage: query.perPage,
        resource,
        selectedIds,
        setFilters: queryModifiers.setFilters,
        setPage: queryModifiers.setPage,
        setPerPage: queryModifiers.setPerPage,
        setSort: queryModifiers.setSort,
        showFilter: queryModifiers.showFilter,
        total: typeof total === 'undefined' ? defaultTotal : total,
        version,
    };
};

export const injectedProps = [
    'basePath',
    'currentSort',
    'data',
    'defaultTitle',
    'displayedFilters',
    'filterValues',
    'hasCreate',
    'hideFilter',
    'ids',
    'loading',
    'loaded',
    'onSelect',
    'onToggleItem',
    'onUnselectItems',
    'page',
    'perPage',
    'refresh',
    'resource',
    'selectedIds',
    'setFilters',
    'setPage',
    'setPerPage',
    'setSort',
    'showFilter',
    'total',
    'version',
];

/**
 * Select the props injected by the useListController hook
 * to be passed to the List children need
 * This is an implementation of pick()
 */
export const getListControllerProps = props =>
    injectedProps.reduce((acc, key) => ({ ...acc, [key]: props[key] }), {});

/**
 * Select the props not injected by the useListController hook
 * to be used inside the List children to sanitize props injected by List
 * This is an implementation of omit()
 */
export const sanitizeListRestProps = props =>
    Object.keys(props)
        .filter(propName => !injectedProps.includes(propName))
        .reduce((acc, key) => ({ ...acc, [key]: props[key] }), {});

export default useListController;
