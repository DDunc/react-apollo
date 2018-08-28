//standard, bringing in react and the prop-types for react libraries
import React from 'react';
import PropTypes from 'prop-types';
// Fuck, I'm sure what these do will become apparent
import ApolloClient, { PureQueryOptions, ApolloError } from 'apollo-client';
// Oh no... this could be anything!
import { DataProxy } from 'apollo-cache';
//What?
const invariant = require('invariant');
//Sure, makes sense
import { DocumentNode, GraphQLError } from 'graphql';
//easy, just to give us a better ===
const shallowEqual = require('fbjs/lib/shallowEqual');
// Typescript types...
import { OperationVariables, RefetchQueriesProviderFn } from './types';
//The parser is the secret sauce that makes the queries happen while handling
// all the other crazy-ass apollo directives
import { parser, DocumentType } from './parser';

// These look familiar, right? You probably had these keys in your redux request middleware reducer
// you wisely deleted to rip out after reading a medium article describing a one-size-fits-all
// magic solution that would do everything right out of the box and save you from the agony of having
// to make decisions based on defining project specifications.

export interface MutationResult<TData = Record<string, any>> {
  data?: TData;
  error?: ApolloError;
  loading: boolean;
  called: boolean;
  client: ApolloClient<Object>;
}
// If you're using graphql-tag (gql``) as damn near everyone seems to be,
// your little template string abomination gets translated into a GraphQL
// DocumentNode Object, which is that big nasty GraphQL object you'll see
// if you foolishly tried to use graphql directly without any libraries.
// Were you not admonished by the sting of a thousand curly braces? Anyway,
// It's worth a look! Naw, I'm just kidding, it leads to a type definition file you'll stare
// at like a dog being shown a card trick. Let's move on.
export interface MutationContext {
  client: ApolloClient<Object>;
  operations: Map<string, { query: DocumentNode; variables: any }>;
}

// The thing I like about typescript is that it's just Javascript with type annotations, definitely
// not C#, no sir.
export interface ExecutionResult<T = Record<string, any>> {
  data?: T;
  extensions?: Record<string, any>;
  errors?: GraphQLError[];
}

// This isn't my comment, we'll just leave this here...

// Improved MutationUpdaterFn type, need to port them back to Apollo Client
export declare type MutationUpdaterFn<
  // So any object, basically?
  T = {
    [key: string]: any;
  }
  // and then the proxy is DataProxy type, and FetchResult is
> = (proxy: DataProxy, mutationResult: FetchResult<T>) => void;

// Fuck me, ok. So there's an array, an array, and it'll be of type
export declare type FetchResult<C = Record<string, any>, E = Record<string, any>> = ExecutionResult<
  C
> & {
  extensions?: E;
  context?: C;
};

export declare type MutationOptions<TData = any, TVariables = OperationVariables> = {
  variables?: TVariables;
  optimisticResponse?: Object;
  refetchQueries?: Array<string | PureQueryOptions> | RefetchQueriesProviderFn;
  awaitRefetchQueries?: boolean;
  update?: MutationUpdaterFn<TData>;
};

export declare type MutationFn<TData = any, TVariables = OperationVariables> = (
  options?: MutationOptions<TData, TVariables>,
) => Promise<void | FetchResult<TData>>;

export interface MutationProps<TData = any, TVariables = OperationVariables> {
  mutation: DocumentNode;
  ignoreResults?: boolean;
  // For when you're sick and tired of being able to differentiate between network issues and
  // view layer bugs.
  optimisticResponse?: Object;
  variables?: TVariables;
  refetchQueries?: Array<string | PureQueryOptions> | RefetchQueriesProviderFn;
  awaitRefetchQueries?: boolean;
  // Why would you want a one to many relationship when you could have a many to many relationship?
  // Remember that time a component in a redux app didn't update and it was because you were missing a key in
  // mapStateToProps? Now imagine how much more convenient it'll be to write custom update functions
  // for every single network response, then add more code to them each time you add a new component
  // or behavior.
  update?: MutationUpdaterFn<TData>;
  // heyooo, children prop as function in the building, remember these types because you'll need them when you
  // do something crazy like try to pass a mutation function as a first class object. Thank goodness
  // these are typ-- oh wait, both TData and TVariables are "any."
  children: (
    mutateFn: MutationFn<TData, TVariables>,
    result: MutationResult<TData>,
  ) => React.ReactNode;
  onCompleted?: (data: TData) => void;
  onError?: (error: ApolloError) => void;
  client?: ApolloClient<Object>;
  context?: Record<string, any>;
}

export interface MutationState<TData = any> {
  called: boolean;
  error?: ApolloError;
  data?: TData;
  loading: boolean;
}

const initialState = {
  loading: false,
  // yo, so wtf is called, what're we doing with our lives?
  called: false,
  error: undefined,
  data: undefined,
};

class Mutation<TData = any, TVariables = OperationVariables> extends React.Component<
  MutationProps<TData, TVariables>,
  MutationState<TData>
> {
  static contextTypes = {
    client: PropTypes.object.isRequired,
    operations: PropTypes.object,
  };

  static propTypes = {
    mutation: PropTypes.object.isRequired,
    variables: PropTypes.object,
    optimisticResponse: PropTypes.object,
    refetchQueries: PropTypes.oneOfType([
      PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object])),
      PropTypes.func,
    ]),
    awaitRefetchQueries: PropTypes.bool,
    update: PropTypes.func,
    children: PropTypes.func.isRequired,
    onCompleted: PropTypes.func,
    onError: PropTypes.func,
  };

  private client: ApolloClient<any>;
  private mostRecentMutationId: number;

  private hasMounted: boolean = false;

  constructor(props: MutationProps<TData, TVariables>, context: any) {
    super(props, context);

    this.client = props.client || context.client;
    //what the fuck, dat error tho
    invariant(
      !!this.client,
      'Could not find "client" in the context or props of Mutation. Wrap ' +
        'the root component in an <ApolloProvider>, or pass an ApolloClient ' +
        'instance in via props.',
    );

    // This function looks like it could be quite handy. Why should a cool function be locked in the prison
    // of a class definition! It makes me sad, that's all!
    this.verifyDocumentIsMutation(props.mutation);

    // Uhoh, what?
    this.mostRecentMutationId = 0;
    //Totally reasonable
    this.state = initialState;
  }

  // Sounds like some stuff is happening on a one off basis before it's mounted!  and unount! Hey gang,
  // let's read ahead to learn more! Oh boy, an advenure's afoot!
  componentDidMount() {
    this.hasMounted = true;
  }

  componentWillUnmount() {
    this.hasMounted = false;
  }

  //Note:
  // Using this lifecycle method often leads to bugs and inconsistencies, and for that reason it is going to be deprecated in the future. -https://reactjs.org/docs/react-component.html#updating-componentwillreceiveprops
  componentWillReceiveProps(
    nextProps: MutationProps<TData, TVariables>,
    nextContext: MutationContext,
  ) {
    const { client } = nextProps;
    if (
      shallowEqual(this.props, nextProps) &&
      (this.client === client || this.client === nextContext.client)
    ) {
      return;
    }

    // fucking runtime errors, how do they work?
    if (this.props.mutation !== nextProps.mutation) {
      this.verifyDocumentIsMutation(nextProps.mutation);
    }

    // if this.client !== nextProps.client && this.client !== nextContext.client, everything is probably
    // fine so let's go ahead and set it back to the intitial state.
    if (this.client !== client && this.client !== nextContext.client) {
      this.client = client || nextContext.client;
      this.setState(initialState);
    }
  }

  render() {
    const { children } = this.props;
    const { loading, data, error, called } = this.state;

    // Relive the magic of pre-flux react state management, except you describe component update behavior
    // in the render method of each component, you represent network requests and responses as view layer
    // components and locally scoped props, and now that they're in the view layer, both your requests
    // and response values are scoped into the component hierarchy(!!) itself instead of being, you know,
    // functions and properties you could define and access anywhere you like.

    // Q: So what if something above this component in the component tree needs any of these values?
    // A: You fucked up. You did. Not us, you. It's your fault. Move this view component to your
    // app root and pass down all of these values. Rerender your entire app every time you make
    // a network request. Or wait, you can use subscriptions!
    // Q: What are subscriptions?
    // A: A way to make your server hold client-side application state using a many-to-many relationship.
    // Q: But don't I just want to write my updated values from the server to my local single centralized state
    // store then subscribe there?
    // A: Why would you do that using any pattern you want when you could simply use a repurposed Meteor
    // module that lets you set up subscriptions in 4 easy steps:
    // It's as easy as:
    // 1) Declaring subscriptions in the GraphQL schema
    // 2) Setup a PubSub instance that our server will publish new events to
    // 3) Hook together PubSub event and GraphQL subscription.
    // 4) Setting up SubscriptionsServer, a transport between the server and the clients

    // Q: No, please, I just need to tell my header element that an input in settings
    // changed the display name string! Isn't there a way to do that?
    // A: I mean theoretically, you could reimplement a slow, buggy, incomplete version of redux with
    // a subtly different API using Context, but you haven't even gotten to the best part of subscriptions:
    // You get to configure your backend to use websockets, and write custom resolvers for *everything!*
    // Q: Why does this feel so familiar?
    // A: Perhaps you've heard of Meteor, everyone's favorite strongly-opinionated, batteries included
    // un-stacktracable framework. And when we say batteries included, we mean batteries _included._
    // It has its own package manager and datastore. But we took those out for Apollo, because the new
    // the new hip thing is publishing a half-dozen repos that you have to use with one another and don't expose
    // a usable surface area except for each other. Almost as though they're a monolith. Almost!
    const result = {
      called,
      loading,
      data,
      error,
      client: this.client,
    };

    // So this.runMutation is the magic mutation function. Meanwhile, result is our good friend
    // who goes by names like "data" or "res" in most of our codebase, or sometimes deprived of even
    // that shred of declaration is and simply reduced to their constituent parts like
    // <Mutation>{(updateFoo, {loading, data, error}) => }</Mutation>.
    // Yeah, because nobody seems to give a _shit_ about called or client. I mean sometimes people
    // need client when they're doing something possibly inadvisable, but who the fuck uses called?

    // Remember when children were just components you rendered?
    return children(this.runMutation, result);
  }

  private runMutation = (options: MutationOptions<TVariables> = {}) => {
    this.onMutationStart();

    const mutationId = this.generateNewMutationId();

    return this.mutate(options)
      .then(response => {
        this.onMutationCompleted(response, mutationId);
        return response;
      })
      .catch(e => {
        this.onMutationError(e, mutationId);
        if (!this.props.onError) throw e;
      });
  };

  private mutate = (options: MutationOptions<TVariables>) => {
    const {
      mutation,
      variables,
      optimisticResponse,
      update,
      context = {},
      awaitRefetchQueries = false,
    } = this.props;
    // Oh Shit yall, that ain't one of my comments. Big warning ahead, refetch of named queries is going the fuck away!
    // Which uh, is kind of bad because I think I used a refetch on query to get the results of a mutation
    // when their scope situation is all screwed up. I never said I was smart, yall.
    let refetchQueries = options.refetchQueries || this.props.refetchQueries;
    // XXX this will be removed in the 3.0 of Apollo Client. Currently, we
    // support refectching of named queries which just pulls the latest
    // variables to match. This forces us to either a) keep all queries around
    // to be able to iterate over and refetch, or b) [new in 2.1] keep a map of
    // operations on the client where operation name => { query, variables }
    //
    // Going forward, we should only allow using the full operation + variables to
    // refetch.
    if (refetchQueries && refetchQueries.length && Array.isArray(refetchQueries)) {
      refetchQueries = (refetchQueries as any).map((x: string | PureQueryOptions) => {
        // Some um, deprecated symbols here in the form of this.context
        if (typeof x === 'string' && this.context.operations)
          // so wait
          return this.context.operations.get(x) || x;
        return x;
      });
      delete options.refetchQueries;
    }

    return this.client.mutate({
      mutation,
      variables,
      optimisticResponse,
      refetchQueries,
      awaitRefetchQueries,
      update,
      context,
      ...options,
    });
  };

  // So wait, is this what was behind the curtain the whole time? It's setting local state to update  then what..
  // passes the object it to children?
  private onMutationStart = () => {
    if (!this.state.loading && !this.props.ignoreResults) {
      this.setState({
        loading: true,
        error: undefined,
        data: undefined,
        // are you fucking kidding me? Called is just a fucking boolean telling you if it's been called
        // that gets flipped once?
        // Sad, it's as though the called value is like a mayfly, being toggled once and then dying.
        called: true,
      });
    }
  };

  private onMutationCompleted = (response: ExecutionResult<TData>, mutationId: number) => {
    // Or wait, no, the other thing. We're paranoid about onMutationCompleted being called
    // either before we mount or after we unmount. Why would that be? Let's read on!
    if (this.hasMounted === false) {
      return;
    }

    // I swear sometimes it seems like typescript makes it harder to figure out what something is
    const { onCompleted, ignoreResults } = this.props;

    const data = response.data as TData;

    // I mean, it's a function. Obviously it's a function. It can't be anything else.
    const callOncomplete = () => (onCompleted ? onCompleted(data) : null);

    // No my child, you must never go into the dark woods
    if (this.isMostRecentMutation(mutationId) && !ignoreResults) {
      // WOW THIS MAKES ME UNCOMFORTABLE, WE'RE DOING IT. WE'RE REALLY DOING IT, HUH? WE'RE USING
      //  SETSTATE CALLBACK? FUCK, OK, POUR IT OUT, LINE IT UP, LET'S DO IT. We got the shouldComponentUpdate
      // going nuts!
      this.setState({ loading: false, data }, callOncomplete);
    } else {
      // AS IF YOU NEEDED MORE PROOF IT WAS A FUNCTION
      callOncomplete();
    }
  };

  // Not reading because errors are something that happens to other people. The mail always goes through,
  // know what I'm talking about? The Postman, starring Kevin Kostner? It was on TNT and USA
  // a lot in the late 1990s.

  // Anyways, the onMutationError function it bails out early if it's not mounted,
  // pulls onError out of the props, uses the same little wrapper we saw before to invoke it if's a function and...
  private onMutationError = (error: ApolloError, mutationId: number) => {
    if (this.hasMounted === false) {
      return;
    }
    const { onError } = this.props;
    const callOnError = () => (onError ? onError(error) : null);

    //Thats right fuckface, loading is done now, your shit is _all_ fucked the fuck up, here's your error,
    // you idiot. Bet you thought you were so damn clever, GUESS NOT!
    // Oh, and what the fuck, let's go ahead and invoke the onError hook as a callback and trigger another
    // component update. Fucking amateur hour over here.
    if (this.isMostRecentMutation(mutationId)) {
      this.setState({ loading: false, error }, callOnError);
    } else {
      callOnError();
    }
  };

  // Something about this method makes me feel unseasy. I can't quite place it, though.
  private generateNewMutationId = (): number => {
    this.mostRecentMutationId = this.mostRecentMutationId + 1;
    return this.mostRecentMutationId;
  };

  private isMostRecentMutation = (mutationId: number) => {
    return this.mostRecentMutationId === mutationId;
  };

  // wait, that's it? So basically we just use invariant to check the type? Ok, well that seems
  // like some extra ceremony. I'm not saying it's wrong, I just would rather see this as a utility,
  // maybe?
  private verifyDocumentIsMutation = (mutation: DocumentNode) => {
    const operation = parser(mutation);
    invariant(
      operation.type === DocumentType.Mutation,
      `The <Mutation /> component requires a graphql mutation, but got a ${
        operation.type === DocumentType.Query ? 'query' : 'subscription'
      }.`,
    );
  };
}

export default Mutation;
